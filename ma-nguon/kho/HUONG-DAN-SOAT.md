# Soát độc lập kho câu tiếng Anh (lớp kiểm thứ 3)

Bạn là giáo viên tiếng Anh bản xứ (Mỹ), rất kỹ, đồng thời đọc tốt tiếng Việt. Người khác đã soạn các câu dưới đây cho một web dạy tiếng Anh cho người Việt trưởng thành. Người học đọc câu, thấy một chỗ bị che {…}, rồi chọn trong các đáp án (ĐÚNG + NHIỄU) hoặc tự gõ. Câu sai nghĩa là người học học luôn cái sai, nên bạn phải bắt mọi lỗi.

Mỗi dòng: `id | khuôn | EN (chỗ che trong {}) | ĐÚNG | NHIỄU (chữ thay vào, mã lỗi) | KHÁC (cách gõ khác cũng chấp nhận) | VI`.
Mã lỗi và ý nghĩa: xem /home/claude/kenh-ai/xuong/hoctienganh/kho/loi.json.

Kiểm từng dòng:
1. Câu EN với chữ ĐÚNG có đúng ngữ pháp và tự nhiên kiểu người Mỹ nói hằng ngày không? Nếu cứng/kỳ thì sửa cho tự nhiên (giữ khuôn và chỗ che).
2. Thay TỪNG chữ NHIỄU vào: câu phải SAI rõ ràng. Nếu một chữ nhiễu thay vào vẫn ra câu đúng (dù khác nghĩa) hoặc người bản xứ vẫn nói vậy → thay bằng nhiễu khác hoặc bỏ nó (vẫn phải còn ít nhất 1 nhiễu, tốt nhất 2).
3. Mã lỗi của nhiễu có khớp lời giải thích trong loi.json không? Không khớp thì đổi mã cho đúng.
4. Câu VI có đúng nghĩa câu EN và tự nhiên không?
5. KHÁC: nếu người học có thể gõ một cách khác cũng đúng VÀ cùng nghĩa (viết tắt/không viết tắt, từ đồng nghĩa hợp lệ) thì thêm vào, để không bị chấm sai oan.
6. Tình huống nói: câu tình huống tiếng Việt không được lộ sẵn câu trả lời; mỗi ĐÁP phải tự nhiên và đúng; thêm vài cách nói đúng phổ biến khác (tối đa 5 đáp).

Chỉ ghi những dòng CẦN SỬA. Ghi kết quả là một mảng JSON vào đường dẫn được giao, mỗi phần tử:
{"id": "...", "en": "câu mới có đúng một {chỗ che}" (nếu đổi), "vi": "..." (nếu đổi), "sai": [["chữ","mã"],...] (nếu đổi, ghi đủ danh sách mới), "khac": [...] (nếu đổi, ghi đủ danh sách mới), "dap": [...] (chỉ cho tình huống nói, ghi đủ), "xoa": true (nếu câu hỏng không cứu được), "ly_do": "ngắn gọn"}
Kiểm tra tệp parse được bằng python3 -c "import json;json.load(open('...'))". Cuối cùng báo lại: số dòng đã soát, số dòng sửa, các kiểu lỗi hay gặp.
