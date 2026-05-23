import essentia.standard as es
import json
import numpy as np

print("1. Dang load danh sach the loai tu JSON...")
with open("models/mtg_jamendo_genre-discogs-effnet-1.json", "r", encoding="utf-8") as f:
    labels = json.load(f)["classes"]

print("2. Dang xu ly file am thanh (test.mp3) voi tan so 16kHz...")
# Đọc file và ép về 16kHz (chuẩn bắt buộc của mô hình Effnet)
audio = es.MonoLoader(filename="test.mp3", sampleRate=16000, resampleQuality=4)()

print("3. Dang chay Model trich xuat dac trung (Embeddings)...")
embeddings = es.TensorflowPredictEffnetDiscogs(
    graphFilename="models/discogs-effnet-bs64-1.pb", 
    output="PartitionedCall:1"
)(audio)

print("4. Dang chay Model phan loai the loai (Genre)...")
activations = es.TensorflowPredict2D(
    graphFilename="models/mtg_jamendo_genre-discogs-effnet-1.pb"
)(embeddings)


# Tìm label có xác suất cao nhất
mean_activations = np.mean(activations, axis=0)

# Lấy ra Top 3 thể loại cao nhất thay vì chỉ 1
top_3_indices = np.argsort(mean_activations)[::-1][:3]

print("\n================================")
print("🎧 KẾT QUẢ DỰ ĐOÁN AI (TOP 3):")
for i in top_3_indices:
    # Nhân 100 để ra thang điểm dễ nhìn, nhưng nhớ đây là điểm độc lập, không phải % tổng
    score = mean_activations[i] * 100 
    print(f"- {labels[i]:<15} : {score:.2f} điểm")
print("================================")
