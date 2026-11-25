# Hướng dẫn soạn câu cho kho câu tiếng Anh

Bạn soạn câu cho một web dạy tiếng Anh cho người Việt trưởng thành (giao tiếp hằng ngày), theo phương pháp "học như AI học": người học đọc một loạt câu chỉ khác nhau đúng MỘT chỗ, rồi che một chỗ và đoán. Câu sai = người học học luôn cái sai, nên ĐỘ CHÍNH XÁC là quan trọng nhất.

## Đầu vào
- `khung.json` / `nhomN.json`: mỗi khuôn có `id`, `lv` (1 cơ bản, 2, 3 nâng cao), `ten` (tên tiếng Việt), `huong` (hướng dẫn: soạn gì, che chữ nào), `loi` (các loại lỗi được dùng làm đáp án nhiễu).
- `loi.json`: danh mục loại lỗi người Việt hay mắc. Mỗi đáp án nhiễu PHẢI gắn một mã trong danh mục này.

## Mỗi khuôn cần
```json
{
 "id": "k011",
 "a": [ 8 câu ],      // bộ đọc lần đầu: câu nén, mỗi câu khác câu ngay trước đúng MỘT chỗ
 "b": [ 6 câu ],      // bộ luyện thêm (dùng khi đoán sai và khi ôn): cùng quy luật, từ vựng khác bộ a
 "noi": [ 2 tình huống ]  // bước nói thẳng
}
```
Mỗi câu:
```json
{"en": "She {wants} to drink coffee.", "vi": "Cô ấy muốn uống cà phê.",
 "sai": [["want","thieu_s"], ["wanting","to_v"]],
 "khac": []}
```
- `en`: đúng MỘT cặp ngoặc nhọn `{...}` bao chữ được che (1–3 chữ, thường là đúng chỗ quy luật của khuôn). Có dấu câu cuối câu.
- `vi`: câu tiếng Việt tự nhiên, đúng nghĩa, kiểu người Việt nói hằng ngày (không dịch word-by-word, không cứng).
- `sai`: 2 hoặc 3 đáp án nhiễu. Mỗi cái là [chữ thay vào chỗ che, mã lỗi]. Đáp án nhiễu phải là LỖI THẬT người Việt hay mắc, và khi thay vào câu phải SAI rõ ràng (không được là một cách nói đúng khác). Không dùng chữ bừa. Cùng dạng viết hoa/thường như chữ đúng.
- `khac`: các cách viết khác cũng đúng khi gõ (vd "do not" cho "don't", "I'm" cho "I am"). Để [] nếu không có.

Mỗi tình huống nói:
```json
{"tinh": "Bạn đang ở quán cà phê, muốn gọi một ly cà phê đá.",
 "dap": ["Can I have an iced coffee, please?", "I'd like an iced coffee, please."]}
```
- `tinh`: tình huống bằng tiếng Việt, KHÔNG chứa câu cần nói (không dịch sẵn).
- `dap`: 2–4 câu trả lời đúng, tự nhiên, dùng đúng khuôn này.

## Quy tắc bắt buộc
1. Tiếng Anh chuẩn Mỹ, tự nhiên, câu người bản xứ thật sự nói. Không câu sách vở kỳ quặc. Nếu không chắc một câu tự nhiên, bỏ nó.
2. Câu ngắn: cấp 1 tối đa 8 chữ, cấp 2 tối đa 10, cấp 3 tối đa 14.
3. Từ vựng: chỉ dùng từ thông dụng (trong khoảng 3000 từ hay gặp nhất). Tên người dùng tên Việt (Lan, Nam, Minh, Hoa, Tuấn, Mai), địa danh Việt (Hanoi, Saigon, Dalat, Danang) hoặc rất phổ biến.
4. Bộ `a` là chuỗi nén: câu 1 là câu gốc, mỗi câu sau đổi ĐÚNG MỘT chỗ so với câu ngay trước (đổi đồ vật, đổi người, đổi động từ, đổi sang phủ định, đổi sang câu hỏi). Phải có ít nhất 2 câu làm lộ quy luật chính (vd đổi I sang She để thấy wants).
5. Chỗ che trong mỗi câu phải là chỗ mà quy luật của khuôn quyết định (để người học đoán bằng dấu hiệu), không che danh từ ngẫu nhiên.
6. Chủ đề đời thường người Việt: ăn uống, đi chợ, làm việc, gia đình, đi lại, nhà cửa, sức khỏe, mua bán.
7. Không nội dung nhạy cảm (chính trị, tôn giáo, dân tộc), không rượu bia quá nhiều, không bạo lực.
8. Mỗi câu trong cùng khuôn khác nhau; bộ b không trùng câu với bộ a.

## Đầu ra
Ghi đúng một tệp JSON (mảng các khuôn) vào đường dẫn được giao. Kiểm tra lại tệp parse được bằng `python3 -c "import json;json.load(open('...'))"`. Trước khi xong, đọc lại từng câu một lần nữa với con mắt giáo viên bản xứ: câu có tự nhiên không, chữ che có đúng không, đáp án nhiễu có chắc chắn sai không, tiếng Việt có đúng nghĩa không. Sửa hết rồi mới báo xong.
