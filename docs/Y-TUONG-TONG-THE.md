# CreditPass — Ý tưởng tổng thể

> **Hộ chiếu tín dụng xuyên chuỗi: biến lịch sử on-chain thật của người dùng thành tín dụng
> under-collateralized trên Creditcoin — được chứng minh bằng mật mã qua Attestcoin Protocol,
> không cần oracle trung tâm.**

Cuộc thi: **BUIDL CTC 2026 Fall — BUIDL For The Real World** · Track: **AI**

---

## 1. Tổng quan trong một câu

Một người đi vay **chứng minh** lịch sử tài chính thật của mình ở bất kỳ blockchain nào; Creditcoin
xác minh bằng proof, lưu thành **Credit Passport**, và một **AI underwriter** cấp khoản vay — tất cả
trustless, không bridge, không oracle tập trung.

## 2. Vấn đề

- **DeFi chỉ cho vay khi đã có crypto thế chấp.** Vay under-collateralized gần như không tồn tại,
  vì trên chuỗi không có "lịch sử tín dụng" để đánh giá.
- **Thị trường tín dụng tiêu dùng truyền thống (hàng nghìn tỷ USD)** vận hành bằng credit history +
  credit bureau — nhưng đó là hệ thống tập trung, đóng, và loại trừ đúng nhóm người cần nhất
  (emerging markets).
- **Các "credit score" on-chain hiện nay** (Cred Protocol, Spectral…) phụ thuộc **oracle/API của một
  công ty**. Người cho vay vẫn phải *tin* một bên thứ ba.
- **Cross-chain hiện tại** (bridge/CCIP/LayerZero) hoặc giữ tài sản hộ (custody — nơi bị hack nhiều
  nhất), hoặc yêu cầu tích hợp first-party từng chain.

## 3. Insight / Cơ hội

Creditcoin sinh ra (2017) đúng để làm **on-chain credit cho emerging markets** (5M giao dịch cho vay,
$100M+ ghi on-chain). CreditPass **mở rộng chính lý do tồn tại đó**: nếu ta có thể *chứng minh* lịch
sử tín dụng của một người ở mọi chain một cách trustless, thì tín dụng under-collateralized trở thành
một primitive hợp pháp, có thể mở rộng toàn cầu.

## 4. Giải pháp — CreditPass là gì

**CreditPass = lớp Credit Identity + Underwriting xuyên chuỗi trên Creditcoin.**

1. Người vay xây dựng lịch sử trên chain nguồn: khóa collateral, trả nợ đúng hạn qua một lending venue.
2. Off-chain worker **chứng minh** các sự kiện đó lên Creditcoin bằng **Attestcoin readability**
   (Merkle + continuity proof), precompile xác minh ngay trong transaction.
3. `CreditPassportASC` giải mã sự kiện đã được chứng minh và ghi **Credit Passport** (collateral,
   chuỗi trả nợ, thu nhập).
4. **AI underwriting agent** đọc passport — nguồn tin cậy duy nhất — và tự cấp khoản vay từ
   `CreditPool`. On-chain `CreditPolicy` là chốt an toàn cuối cùng: agent không thể vượt hạn mức đã verify.

## 5. Luồng end-to-end

```
Ethereum (chain nguồn)                              Creditcoin (execution)
──────────────────────                              ──────────────────────
CreditHistorySource                                 CreditPassportASC (ASCBase)
  emit CollateralDeposited      proof                 └─ Block Prover precompile 0x…FD2
  emit RepaymentRecorded   ───────────────▶           CreditPolicy  (chấm điểm minh bạch)
  emit IncomeReceived                                 CreditPool    (thanh khoản + khoản vay)
MockLendingVenue                                      Mock USD1
        │ events                                              ▲
        ▼                                                     │ underwrite()
  Off-chain worker ── chờ attestation → ProofBuilder ──▶ AI underwriting agent
                     (Merkle + continuity proof)          (đọc passport, ghi decision hash)
```

Stages quan sát được: `emitted → attesting → attested → proved` (hoặc `failed`).

## 6. Vì sao Attestcoin là lõi (moat)

Giá trị sản phẩm **chỉ tồn tại nhờ đúng năng lực độc nhất của Attestcoin**:

- **Pull-based, không cần tích hợp gì trên source chain** → chứng minh được lịch sử *đã có từ trước*,
  retroactive. Bridge/Chainlink không làm được.
- **Continuity proof neo về genesis** → chứng minh **lịch sử** mà sự kiện thuộc về, chống fork-substitution
  và history-gap. Đây chính là thứ khiến dữ liệu tín dụng *đủ an toàn để cho vay tiền thật*.
- **Không giữ tài sản (no custody)** → không có "honeypot" để hack.

> Goldfinch cần con người tin nhau. Cred/Spectral cần oracle. **CreditPass chỉ cần proof.**

## 7. Kiến trúc & thành phần

| Lớp | Thành phần | Vai trò |
|---|---|---|
| Source (Sepolia) | `CreditHistorySource` | Phát event tối giản, tên rõ nghĩa |
| Source (Sepolia) | `MockLendingVenue` | Tạo lịch sử trả nợ có thẩm quyền (recorder) |
| Creditcoin | `CreditPassportASC` | Verify proof (`0xFD2`), replay protection, emitter allowlist, check receipt status, ghi passport |
| Creditcoin | `CreditPolicy` | Chấm điểm/limit/tier minh bạch, deterministic |
| Creditcoin | `CreditPool` | LP deposit, giải ngân theo hạn mức, role `underwriter` cho AI |
| Off-chain | Worker / Relayer | Chờ attestation → sinh proof → submit |
| Off-chain | AI underwriting agent | Đọc passport → quyết định + rationale hash on-chain |
| DApp | `web/` | Connect wallet, network switch, actions on-chain, dashboard, pipeline telemetry |

## 8. Vai trò AI

- AI agent là **underwriter tự động**: đọc dữ liệu đã-verify, ra quyết định, trigger giao dịch on-chain,
  ghi `decisionHash` + rationale.
- **An toàn:** on-chain `CreditPolicy` là chốt cuối — model chỉ *đề xuất*, math đã verify mới là *cho phép*.
  Một model lỗi cũng không thể vượt hạn mức đã chứng minh.
- Đúng mô tả track AI: "AI xử lý dữ liệu cross-chain đã verify để tự ra quyết định và trigger giao dịch
  on-chain without centralized oracle operators."

## 9. Điểm khác biệt

| | Cách tiếp cận | Hạn chế | CreditPass |
|---|---|---|---|
| Bridge / CCIP / LayerZero | Message passing, committee/oracle | Cần tin bên thứ ba; custody | Prove lịch sử đến genesis, không custody |
| Cred / Spectral | Chấm điểm bằng oracle/API | Tin một công ty; đơn chain | Dữ liệu prove trustless, đa chain |
| Goldfinch | Undercollateralized, backers bỏ vốn | Tin chủ quan qua consensus người | Tin bằng mật mã, tự động |
| Truyền thống (FICO) | Credit bureau tập trung | Đóng, loại trừ emerging markets | Mở, portable, on-chain |

## 10. Giá trị cho hệ sinh thái Creditcoin (compounding)

- **Mở rộng user base:** kéo người dùng thật cần tín dụng (emerging markets, luồng Gluwa/Trugi) — không
  phải trader.
- **Primitive dùng chung:** ví, lending, RWA protocol khác trên Creditcoin đều query được Credit Passport
  → network effect.
- **Tạo nhu cầu CTC (gas) + ATC (phí attest)** — hoạt động thật cho cả hai token.
- **Khép vòng với fiat rails sẵn có** (Trugi NGN, PenguinSwap USD1): vay → dùng → trả → tăng điểm → vay tiếp.
- **Con đường CEIP:** đúng 5 tiêu chí (user expansion, technical alignment, product vision, execution,
  market relevance).

## 11. Thị trường & mô hình kinh doanh

- **Now:** phí underwriting/handling trên khoản vay; dữ liệu passport miễn phí cho reader (đúng thiết kế
  Attestcoin: reads free, writes metered).
- **Later:** API Credit Passport cho lender/wallet khác (credit data infrastructure), risk tiers trả phí,
  tích hợp fiat on/off-ramp.
- **Đối tượng:** người vay chưa có collateral (emerging markets), lending protocol cần tín hiệu rủi ro,
  ví cần sản phẩm credit.

## 12. Roadmap

- **Now (MVP):** readability-only, 1 source chain (Sepolia), verified history → underwriting → loan on
  Creditcoin testnet, dashboard + telemetry + AI agent.
- **Next:** thêm Ethereum mainnet (chainKey 3) + Bitcoin UTXO history; writability để trigger action ngược
  lại; passport thành primitive registry queryable công khai.
- **Later:** under-collateralized thật nhiều pool, chống sybil, privacy (prove mà không lộ dữ liệu),
  tích hợp Trugi NGN để người dùng thật on-ramp → vay → trả → xây credit.

## 13. Định vị cuộc thi

- **Track:** AI (`#AI Agents`, `#Onchain Decisioning`, `#Verified Data`).
- **Attestcoin integration:** là lõi sản phẩm, depth cao — nhiều loại event, precompile verify, replay
  protection, emitter allowlist, receipt-status, proof-driven state machine.
- **Đối chiếu 5 tiêu chí:**
  1. User base expansion — tín dụng cho emerging markets.
  2. Technical alignment — dùng sâu năng lực độc nhất của Attestcoin.
  3. Product vision — Credit Passport là primitive, có roadmap rõ.
  4. Execution — demo end-to-end chạy thật (contracts + worker + agent + FE + test).
  5. Market relevance — RWA + AI + real-world credit.

## 14. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Attestation chậm/timeout | Worker retry, telemetry theo stage, chạy trước khi quay demo |
| Nguồn dữ liệu bị giả (borrower tự bịa repayment) | Source contract giới hạn recorder; ASC allowlist emitter + check success |
| Model AI lỗi | On-chain `CreditPolicy` là chốt an toàn, agent chỉ đề xuất |
| Khó decode event chéo chain | Bám best-practice: event riêng, rõ nghĩa, đủ dữ liệu |
| Hết thời gian / scope loãng | MVP readability-only; writability để roadmap |

## 15. Trạng thái hiện tại (đã build)

- 7 smart contract (Sepolia + Creditcoin), **13 Foundry test pass**.
- Worker readability + AI underwriting agent + script local E2E (2 Anvil devnet).
- DApp Web3: connect wallet, network switch, actions on-chain (borrower/underwriter), dashboard, policy
  simulator, proof pipeline telemetry.
- Docs: README, Attestcoin Integration Summary, deck outline, demo script, tài liệu này.
- Repo: https://github.com/vonhatcuong/creditpass
- Demo public (dữ liệu mẫu): https://vonhatcuong.github.io/creditpass/
- Demo local (dữ liệu thật): chạy `LOCAL_KEEP_ALIVE=1 npm run local:e2e` → `npm run serve`

## 16. Đội ngũ & kêu gọi

<!-- điền: tên, vai trò, kinh nghiệm, link -->

**Ask:** tham gia CEIP fast-track để phát triển CreditPass thành lớp credit identity mặc định của hệ sinh
thái Creditcoin — nơi tín dụng on-chain bắt đầu từ bằng chứng, không từ niềm tin.
