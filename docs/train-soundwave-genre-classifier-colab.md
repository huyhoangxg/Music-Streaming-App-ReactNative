# Train SoundWave genre classifier on Google Colab

Mục tiêu của phần này là train lại **classifier head** cho 11 genre của app, không train lại toàn bộ audio CNN từ đầu.

Pipeline đang dùng:

```text
audio -> Discogs EffNet embedding -> genre classifier -> primaryGenre / top genres
```

Sau khi train xong, app vẫn dùng `discogs-effnet-bs64-1.pb` để trích embedding, nhưng thay classifier `mtg_jamendo_genre-discogs-effnet-1.pb` bằng model riêng:

```text
soundwave_genre_classifier.keras
soundwave_genre_classifier.json
```

## 1. Chuẩn bị dữ liệu

Tạo folder trên Google Drive:

```text
MyDrive/soundwave-genre-training/
  dataset/
    Pop/
      song_001.mp3
      song_002.wav
    Rap-Hip-Hop/
      song_001.mp3
    R&B/
    Rock/
    Indie/
    EDM/
    Lo-Fi/
    Jazz/
    Acoustic/
    Bolero/
    Other/
  base_models/
    discogs-effnet-bs64-1.pb
    discogs-effnet-bs64-1.json
  cache/
  output/
```

Copy 2 file base model từ repo local:

```text
streaming-app-ai-service/models/discogs-effnet-bs64-1.pb
streaming-app-ai-service/models/discogs-effnet-bs64-1.json
```

vào Google Drive:

```text
MyDrive/soundwave-genre-training/base_models/
```

Khuyến nghị dữ liệu:

- Tối thiểu để demo: 20-30 bài mỗi genre.
- Dùng tạm được: 50-100 bài mỗi genre.
- Tốt hơn: vài trăm bài mỗi genre.
- Không để cùng một bài remix/copy nằm cả train và test.
- Nếu bài nhập nhằng, đặt vào genre người nghe Việt Nam thường hiểu nhất, hoặc bỏ vào `Other`.
- Dataset dùng folder `Rap-Hip-Hop` vì tên folder không thể chứa `/`, nhưng label export cho app vẫn là `Rap/Hip-Hop`.
- Nếu đã có dataset cũ, gộp file trong `Hip-Hop/` và `Rap/` vào `Rap-Hip-Hop/`, thay folder `Classical/` bằng dữ liệu `Bolero/`.
- Notebook taxonomy mới dùng cache `soundwave_discogs_effnet_segments_taxonomy_v2.npz`, không tái sử dụng cache cũ có label `Rap`, `Hip-Hop`, `Classical`.

## 2. Mở Google Colab

1. Vào `https://colab.research.google.com`.
2. Chọn `File -> Open notebook -> Upload`.
3. Upload file:

```text
notebooks/train_soundwave_genre_classifier_colab.ipynb
```

4. Chọn `Runtime -> Change runtime type`.
5. `Hardware accelerator`: chọn `GPU`.
6. Bấm `Save`.
7. Chạy từng cell từ trên xuống.

Colab runtime có thể thay đổi theo thời gian. Google khuyến nghị dùng runtime mới nhất và tự cài version thư viện cần thiết trong notebook. Nếu gặp lỗi runtime/package, restart runtime rồi chạy lại từ đầu.

## 3. Chạy notebook

The updated notebook keeps Essentia embedding extraction in a child Python process and imports
TensorFlow in the Colab kernel only after the embedding cache is ready. Do not merge those imports
back into the same setup cell. Essentia documents that importing its TensorFlow algorithms together
with Python TensorFlow can cause package collisions.

If an older copy of the notebook crashes the Colab kernel with `RegisterAlreadyLocked`,
`Status: ALREADY_EXISTS: Op with name Bitcast`, or repeated kernel restarts:

1. Stop the running cell.
2. Use `Runtime -> Restart session`.
3. Upload or reopen the updated notebook from `notebooks/train_soundwave_genre_classifier_colab.ipynb`.
4. Run again from the Drive mount cell.

Trong notebook, kiểm tra biến:

```python
DRIVE_ROOT = Path("/content/drive/MyDrive/soundwave-genre-training")
LABELS = ["Pop", "Rap/Hip-Hop", "R&B", "Rock", "Indie", "EDM", "Lo-Fi", "Jazz", "Acoustic", "Bolero", "Other"]
```

Nếu folder Drive của m khác thì sửa `DRIVE_ROOT`.

Các cell chính:

1. Mount Google Drive.
2. Cài package.
3. Scan dataset theo folder genre.
4. Trích embedding từ audio bằng Essentia trong child process và lưu cache `.npz`.
5. Split train/validation/test theo **track**, không split random theo segment.
6. Import TensorFlow trong kernel chính và train classifier.
7. Evaluate.
8. Export model.

Cell trích embedding sẽ kiểm tra trước `DRIVE_ROOT`, `dataset/` và file
`base_models/discogs-effnet-bs64-1.pb`. Nó chỉ tạo `cache/` sau khi các path đầu vào
đã đúng, nên nếu path sai thì sửa path trước khi chạy tiếp.
Nếu session Colab đã restart và mất biến cấu hình, cell này tự dựng lại đường dẫn
mặc định từ `/content/drive/MyDrive/soundwave-genre-training`. Google Drive vẫn phải
được mount trước.

Khi trích embedding, cell sẽ log theo bước:

```text
Scanning dataset ...
Found ... audio file(s).
Importing Essentia TensorFlow algorithms ...
Loading embedding model ...
[1/N] Genre: file.mp3
```

Nếu cell đứng lâu, dòng log cuối cùng cho biết nó đang kẹt ở import Essentia,
load model hay một file audio cụ thể.

Nếu chỉ thấy `Running embedding extractor...` mà không thấy các dòng phía dưới,
đó là bản notebook cũ chưa stream stdout từ child process về Colab. Stop cell,
restart session và upload lại notebook mới trước khi chạy tiếp.

Notebook cũng bỏ qua warning native lặp lại của Essentia:

```text
No network created, or last created network has been deleted
```

Warning này không phải progress và có thể làm Colab truncate output. Bản notebook
mới lọc nó ở cell trích embedding để vẫn giữ log file đang xử lý và lỗi thật.

Sau khi chạy xong, file model nằm ở:

```text
MyDrive/soundwave-genre-training/output/soundwave_genre_classifier.keras
MyDrive/soundwave-genre-training/output/soundwave_genre_classifier.json
MyDrive/soundwave-genre-training/output/soundwave_genre_classifier.zip
```

## 4. Đưa model về project

Copy 2 file này từ Google Drive về:

```text
streaming-app-ai-service/models/soundwave_genre_classifier.keras
streaming-app-ai-service/models/soundwave_genre_classifier.json
```

Giữ nguyên base embedding model hiện tại:

```text
streaming-app-ai-service/models/discogs-effnet-bs64-1.pb
streaming-app-ai-service/models/discogs-effnet-bs64-1.json
```

## 5. Sửa `.env` của AI service

Trong `streaming-app-ai-service/.env`, đổi:

```env
GENRE_CLASSIFIER_BACKEND=keras
GENRE_MODEL_PATH=./models/soundwave_genre_classifier.keras
GENRE_METADATA_PATH=./models/soundwave_genre_classifier.json
```

Các dòng embedding giữ nguyên:

```env
EMBEDDING_MODEL_PATH=./models/discogs-effnet-bs64-1.pb
EMBEDDING_METADATA_PATH=./models/discogs-effnet-bs64-1.json
```

## 6. Restart AI service

Trong WSL:

```bash
cd /mnt/d/DownloadApps/vscode/workSpace/music-streaming-app/streaming-app-ai-service
source ~/.venv_streaming_ai/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Check health:

```bash
curl http://127.0.0.1:8000/health
```

Kỳ vọng:

```text
classifierLabelsCount = 11
modelVersion = soundwave_genre_classifier-v1
readinessIssues = []
```

## 7. Reanalyze bài cũ

Backend:

```powershell
cd D:\DownloadApps\vscode\workSpace\music-streaming-app\streaming-app-backend
npm run reanalyze:genres -- --all
```

Terminal sẽ log:

```text
-> success: ai=Rap/Hip-Hop, final=Rap/Hip-Hop, confidence=0.812, top=Rap/Hip-Hop=0.812
```

## 8. Nếu kết quả vẫn kém

Kiểm tra theo thứ tự:

1. Dataset có cân bằng không. Nếu `Pop` 500 bài nhưng `Jazz` 20 bài thì model lệch.
2. Label có sạch không. Nếu một bài rap bị bỏ vào `Pop`, model học sai.
3. Train/test có trùng bài không. Nếu trùng, metric nhìn đẹp nhưng thực tế kém.
4. Genre nhập nhằng thì nên chấp nhận top genres thay vì ép 1 genre.
5. Không nên để quá nhiều bài chất lượng thấp, intro dài, file lỗi, hoặc nhạc không đúng genre.

## 9. Nguồn tham khảo

- Google Colab runtime versions: https://research.google.com/colaboratory/runtime-version-faq.html
- Google Colab FAQ: https://research.google.com/colaboratory/intl/en-GB/faq.html
- Essentia models: https://essentia.upf.edu/documentation/models.html
- Essentia TensorflowPredict2D: https://essentia.upf.edu/reference/streaming_TensorflowPredict2D.html
