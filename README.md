# Học tiếng Anh theo cách AI học ngôn ngữ

Web học tiếng Anh cá nhân, tự cài lên tài khoản Cloudflare **miễn phí** của chính bạn bằng một câu lệnh dán vào Claude.

**Cách cài nhanh:** mở https://imclaude-tienganh.pages.dev, bấm **Chép câu lệnh**, dán vào Claude và làm theo. (Câu lệnh đầy đủ ở [CAU-LENH.txt](CAU-LENH.txt).)

## Phương pháp
AI không học công thức. Nó chơi một trò duy nhất: che chữ tiếp theo rồi đoán, sai thì chỉnh, lặp lại thật nhiều lần, cho tới khi cái đúng thành phản xạ. Web nén cách học đó lại cho vừa sức người:

1. Học khuôn câu thông dụng trước, câu gần với nghề của bạn (12 nghề).
2. Đọc và nghe một loạt câu chỉ khác nhau đúng một chỗ, chỗ khác được tô màu, có câu tiếng Việt bên cạnh.
3. Che một chỗ rồi đoán trong vài giây (chọn, gõ, hoặc chỉ nghe).
4. Sai thì tô đỏ và đưa ngay 2–3 câu cùng kiểu để đoán lại.
5. Tự giữ độ khó quanh mức đúng 8/10.
6. Ôn lúc sắp quên (thuật toán FSRS), trộn các khuôn với nhau khi ôn.
7. Sai cùng một kiểu 3 lần mới hiện một câu giải thích ngắn.
8. Bỏ dần tiếng Việt: chỉ còn tình huống, nói thẳng vào máy, đo số giây trước khi mở miệng.
9. Cuối ngày kể vài câu, AI sửa, câu bị sửa thành bài của ngày mai.

## Bên trong
- `ma-nguon/web/src/server.js`: máy chủ (Cloudflare Worker + D1 + Workers AI: Whisper nghe giọng nói, Llama sửa câu).
- `ma-nguon/web/src/dongco.js`: động cơ học (chạy trong trình duyệt, học được cả khi mất mạng).
- `ma-nguon/web/src/app.js`, `index.html`: giao diện.
- `ma-nguon/kho/`: kho câu gốc (114 khuôn câu, 12 gói nghề, khoảng 2.100 câu), công cụ kiểm tra và tạo giọng đọc.
- `nguon/`: bản đã đóng gói để cài (`maychu.txt`, `giaodien.json`, `kho.json`, `am*.txt` giọng đọc).

Kho câu được kiểm 3 lớp: máy kiểm cấu trúc và từ vựng, đối chiếu với câu thật của Tatoeba, và người soát độc lập đọc lại từng câu, từng đáp án nhiễu.

## Giấy phép và ghi nguồn
- Mã nguồn: MIT.
- Kho câu và giọng đọc: CC BY-SA 4.0.
- Danh sách từ thông dụng: New General Service List (Browne, Culligan & Phillips), CC BY-SA 4.0.
- Giọng đọc tạo bằng Kokoro-82M (Apache 2.0). Thuật toán ôn tập FSRS-4.5 (tham số mặc định công bố).
