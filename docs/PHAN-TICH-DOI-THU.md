# Phân tích đối thủ & chiến lược — BUIDL CTC 2026 Fall

Nguồn: trang BUIDLs của hackathon (`dorahacks.io/hackathon/buidl-ctc-2026-fall/buidl`), render bằng
trình duyệt thật. Trang báo **~62 BUIDLs**; danh sách public hiển thị **24 dự án** (mẫu quan sát được).

## 1. Kết luận nhanh

**Ý tưởng "credit passport / chứng minh lịch sử trả nợ xuyên chuỗi để cho vay under-collateralized
bằng Attestcoin" đã bị commoditize.** Có ít nhất **10–12 dự án gần như trùng core với CreditPass.**
Nếu nộp đúng định vị hiện tại, CreditPass chỉ là "một trong nhiều bản sao" → rủi ro cao.

**Đòn bẩy thắng:** đổi định vị từ *một app cho vay* sang **hạ tầng credit primitive của Creditcoin**,
kèm 2–3 khác biệt kỹ thuật cụ thể mà các đối thủ trong cluster chưa làm.

## 2. Cluster cạnh tranh

### A. Trùng core với CreditPass (lending + passport + Attestcoin readability)
| Dự án | Cốt lõi | Mức trùng |
|---|---|---|
| **Credit Passport** | credit portable, soulbound credential, verify repayments Ethereum → vay trên Creditcoin | Rất cao (gần như định vị y hệt) |
| **AttestFlow** | "AI-powered credit passport", cross-chain proof of credit history | Rất cao |
| **AttestLend Passport** | verify Sepolia repayments → portable trustless Credit Passport | Rất cao |
| **credence** | "cryptographically verifiable credit scoring + undercollateralized lending via Attestcoin" | Rất cao |
| **CredX Protocol** | cross-chain trustless credit bureau + Attestcoin engine (nhắc precompile 0x0FD2) | Cao |
| **AttestCredit** | portable verifiable credit history (đúng sứ mệnh Creditcoin) | Cao |
| **Miro Passport** | repayment history cross-chain để pricing borrower | Cao |
| **Acoris** | portable provable reputation, credit chỉ từ bằng chứng mật mã | Cao |
| **Risk-X** | AI + verified financial history → lending | Cao |
| **credit-sentinel** | repayment behavior → verifiable credentials, credit identity | Trung bình–cao |
| **nomen** | prove sự kiện **Aave v3 / Morpho Blue / Spark** từ Ethereum → Creditcoin | Cao + **sâu hơn** (protocol thật) |
| **Toxa** | lock ETH Sepolia → prove → loan theo score, LTV động (repay → terms tốt hơn) | Cao |

### B. Infra/security liền kề (khác core nhưng đáng chú ý)
- **Singleton** — chống pledge trùng collateral trên nhiều chain (registry trung lập).
- **ThirdCheck** — lớp an ninh cho settlement Attestcoin (đóng "third check" của proof).
- **IntentFi** — policy/compliance safety layer cho giao dịch tài chính do AI điều khiển.
- **Milestone Relay Evidence Registry** — registry bằng chứng xuyên chuỗi chống trùng.
- **Sky Exec** — chặn agent mutate giao dịch sau khi approve.

### C. Vertical khác (không trùng, dùng làm ý tưởng học hỏi)
- **Sanad Protocol** — vàng/pawnshop token hoá NFT, tài chính Shariah cho unbanked (real-world collateral).
- **Kirogi** — remittance "purpose-bound" (giải ngân đúng mục đích, Creditcoin settle khi verify).
- **AttestFlow (bản supply chain)** — supply chain finance / working capital.
- **SpaceShield** — DePIN bảo hiểm vệ tinh; **ProofPerks** — cashback từ receipt.

## 3. Điểm mạnh / yếu của CreditPass so với cluster

**Mạnh:**
- Depth Attestcoin khá: nhiều loại event, verify precompile, replay protection, emitter allowlist, check receipt status, policy deterministic.
- **Execution đầy đủ**: contracts + worker + AI agent + DApp Web3 (wallet, actions, telemetry) + 13 test + local E2E + docs. Đây là lợi thế lớn vì nhiều đối thủ chỉ có prototype.
- Quan sát được (telemetry/pipeline).

**Yếu:**
- **Định vị trùng lặp** — không có cơ chế độc nhất nào để nhớ tên.
- Chưa dùng **protocol thật** (Aave/Morpho) như nomen; mới dùng contract demo.
- AI mới ở mức "underwriter một lần", chưa đủ "agentic" để bật khỏi cluster AI.

## 4. Chiến lược đề xuất: đổi định vị + 3 khác biệt

### Định vị mới
> **CreditPass = lớp Credit Identity dùng chung của Creditcoin** — nơi mọi dApp xác minh danh tính tín
> dụng của người dùng bằng proof, do một AI agent vận hành liên tục.

Không bán "một khoản vay" — bán **primitive cho toàn hệ sinh thái**.

### 3 khác biệt cụ thể (ưu tiên theo ROI/thời gian)
1. **Chứng minh lịch sử từ Ethereum MAINNET thật (chainKey 3), không deploy gì ở source chain**
   → flex đúng năng lực độc nhất "prove history that predates the dApp". Chỉ cần decode một sự kiện
   mainnet có sẵn (vd ERC20 transfer của chính borrower). Đây là "wow" depth mạnh nhất.
2. **Composability: ≥2 consumer độc lập của Credit Passport**
   → thêm một consumer thứ hai (vd `CreditGate` chặn/cho phép một hành động theo score, hoặc một pool
   thứ hai) để chứng minh passport là **hạ tầng dùng chung**, không phải app. Trực tiếp ăn tiêu chí
   "user base expansion".
3. **AI agent liên tục (agentic), không một lần**
   → agent theo dõi tín hiệu đã-verify và **điều chỉnh hạn mức / đóng băng / giải ngân** theo thời gian,
   ghi rationale hash mỗi lần. Khác biệt với "AI credit score" một phát của đối thủ.

### Gia cố thêm (nếu kịp)
4. **Fraud guard liên chuỗi**: phát hiện cùng một collateral bị pledge ở 2 chain (khác Singleton ở chỗ
   gắn vào credit flow) — tùy chọn.
5. **Meta-attestation**: attest chính passport/score thành credential để chain/dApp khác đọc.

## 5. Kế hoạch hành động còn lại (ưu tiên)

| Ưu tiên | Việc | Lý do |
|---|---|---|
| P0 | Thêm proof **mainnet chainKey 3** vào luồng demo | Khác biệt depth mạnh nhất, chi phí thấp |
| P0 | Hoàn thiện **submission** (team info, deck PDF, demo video, link) | Nhiều đối thủ thiếu; execution là điểm ăn |
| P1 | Thêm **consumer thứ hai** của passport | Định vị "primitive", ăn tiêu chí user expansion |
| P1 | Nâng AI thành **agent loop** có telemetry | Bật khỏi cluster "AI credit passport" giống nhau |
| P2 | Cập nhật README/idea doc theo định vị mới + bảng so sánh rõ | Judges đọc doc |

## 6. Rủi ro
- Nếu giữ định vị cũ → bị hòa lẫn giữa 10+ dự án giống nhau.
- Mainnet proof cần event decodable; chọn ERC20 transfer/pool event đơn giản để giảm rủi ro.
- Không sa đà thêm feature mà bỏ sót submission (deck/video) — đây là nguyên nhân thua phổ biến.
