from pathlib import Path
import io
import json
import zipfile

import numpy as np


class KerasNumpyClassifier:
    def __init__(
        self,
        batch_norm: tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray],
        dense_layers: list[tuple[np.ndarray, np.ndarray, str]],
        batch_norm_epsilon: float,
    ) -> None:
        self.gamma, self.beta, self.moving_mean, self.moving_variance = batch_norm
        self.dense_layers = dense_layers
        self.batch_norm_epsilon = batch_norm_epsilon

    @classmethod
    def load(cls, model_path: str | Path) -> "KerasNumpyClassifier":
        try:
            import h5py  # type: ignore
        except Exception as error:
            raise RuntimeError(
                "GENRE_CLASSIFIER_BACKEND=keras requires h5py. "
                "Run `pip install h5py` in the AI service environment."
            ) from error

        with zipfile.ZipFile(model_path) as archive:
            config = json.loads(archive.read("config.json").decode("utf-8"))
            weights_buffer = io.BytesIO(archive.read("model.weights.h5"))

        layers_config = config.get("config", {}).get("layers", [])
        dense_configs = [
            layer.get("config", {})
            for layer in layers_config
            if layer.get("class_name") == "Dense"
        ]
        batch_norm_config = next(
            (
                layer.get("config", {})
                for layer in layers_config
                if layer.get("class_name") == "BatchNormalization"
            ),
            {},
        )
        batch_norm_epsilon = float(batch_norm_config.get("epsilon", 0.001))

        with h5py.File(weights_buffer, "r") as weights:
            batch_norm = tuple(
                np.asarray(weights[f"layers/batch_normalization/vars/{index}"], dtype=np.float32)
                for index in range(4)
            )
            dense_group_names = sorted(
                (name for name in weights["layers"].keys() if name.startswith("dense")),
                key=lambda name: int(name.split("_")[1]) if "_" in name else 0,
            )

            dense_layers: list[tuple[np.ndarray, np.ndarray, str]] = []
            for index, group_name in enumerate(dense_group_names):
                layer_group = weights[f"layers/{group_name}/vars"]
                kernel = np.asarray(layer_group["0"], dtype=np.float32)
                bias = np.asarray(layer_group["1"], dtype=np.float32)
                activation = str(dense_configs[index].get("activation", "linear"))
                dense_layers.append((kernel, bias, activation))

        if len(batch_norm) != 4 or not dense_layers:
            raise ValueError(f"Unsupported Keras classifier format: {model_path}")

        return cls(
            batch_norm=batch_norm,  # type: ignore[arg-type]
            dense_layers=dense_layers,
            batch_norm_epsilon=batch_norm_epsilon,
        )

    def predict(self, inputs: np.ndarray, verbose: int = 0) -> np.ndarray:
        del verbose

        activations = np.asarray(inputs, dtype=np.float32)
        if activations.ndim == 1:
            activations = activations.reshape(1, -1)

        activations = (
            (activations - self.moving_mean)
            / np.sqrt(self.moving_variance + self.batch_norm_epsilon)
            * self.gamma
            + self.beta
        )

        for kernel, bias, activation in self.dense_layers:
            activations = activations @ kernel + bias
            if activation == "relu":
                activations = np.maximum(activations, 0)
            elif activation == "softmax":
                activations = self._softmax(activations)
            elif activation not in ("linear", "None", "none"):
                raise ValueError(f"Unsupported dense activation: {activation}")

        return np.asarray(activations, dtype=np.float32)

    @staticmethod
    def _softmax(values: np.ndarray) -> np.ndarray:
        shifted = values - np.max(values, axis=-1, keepdims=True)
        exp_values = np.exp(shifted)
        return exp_values / np.sum(exp_values, axis=-1, keepdims=True)
