# 🏥 Hedera APEX Healthcare Consent & Record System (DPDP Act 2023 Compliant)

[![Built with Hedera](https://img.shields.io/badge/Built%20with-Hedera-blue)](https://hedera.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React.js-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Storage](https://img.shields.io/badge/Storage-IPFS%20%7C%20Pinata-41B883?logo=ipfs&logoColor=white)](https://pinata.cloud/)

A decentralized, privacy-first healthcare platform built on the **Hedera network**. This system is specifically architected to comply with India's **Digital Personal Data Protection (DPDP) Act of 2023**, guaranteeing secure consent management, zero-knowledge verifiable audits, and complete patient sovereignty over medical data.

---

## 🌟 Key Features

### 🔏 DPDP Act Compliance Engine
- **Notice & Consent (Section 5 & 6):** Patients govern cryptographic access requests. Data Fiduciaries (Doctors, Labs, Pharmacies) cannot access records without on-chain, explicitly granted, time-bound consent.
- **Right to Erasure (Section 12):** Patients can instantly revoke access or trigger "Erasure" protocols to permanently break decryption ties to their offline encrypted payloads.
- **Immutable Audit Trail:** Every view, upload, and consent modification generates an undeniable transaction hash stored via smart contracts, preventing silent data breaches.

### 🌐 Decentralized Architecture
- **EVM-Compatible Smart Contracts:** Built using Solidity and deployed on Hedera Testnet, utilizing Hedera's high-speed, low-cost consensus mechanism.
- **Role-Based Access Control (RBAC):** Distinct dashboards for Patients, Doctors, Hospitals, Labs, Pharmacies, Insurance Providers, and Auditors.
- **IPFS End-to-End Encryption:** Medical records are never stored in plain text. Payloads are symmetrically encrypted locally in the browser, uploaded to the decentralized IPFS network (via Pinata), and only the secure `CID` (hash) is mapped on-chain.

### 🚀 Advanced Workflows
- **Global Prescription Queue:** Doctors can write secure prescriptions mapping to a patient. Pharmacies intercept this global queue but must execute a "Request Access -> Patient Approve -> Decrypt & Dispense" flow to view the sensitive medication details.
- **Zero-Knowledge Insurance Payouts:** Insurance dashboards query the blockchain for the *existence* of a verified medical event (like a confirmed prescription dispensation) without needing to view the underlying clinical diagnosis.
- **Short Wallet Identifier System:** Replaces the cumbersome 42-character `0x` addresses with user-friendly 6-character Short IDs (mapped immutably on-chain).

---

## 🏗️ System Architecture

### Smart Contracts (Hedera Testnet)
1.  **`PatientRegistry.sol`**: Manages universal identities securely linking wallets.
2.  **`RoleBasedAccess.sol`**: Governs system permissions (Admin, Doctor, Lab, Pharmacy...).
3.  **`DataFiduciaryRegistry.sol`**: Validates organizational credentials before they can interact with patient data.
4.  **`ConsentManager.sol`**: The core protocol governing data sharing agreements, expiries, and revocations.
5.  **`DataAccessManager.sol`**: A strict gateway that validates active consent before revealing IPFS CIDs to fiduciaries.
6.  **`MedicalRecords.sol`**: Manages the mapping of IPFS encrypted payloads to patient wallets and operates the Global Prescription Queue.
7.  **`AuditLog.sol`**: A global event listener charting every action for regulatory compliance.
8.  **`WalletMapper.sol`**: Maps friendly 6-character Short IDs to their parent `0x` wallet configurations.

### Tech Stack
-   **Blockchain:** Hedera, Solidity, Hardhat, Ethers.js
-   **Frontend:** Vite, React 18, Glassmorphism UI/UX
-   **Storage:** IPFS, Pinata, CryptoJS (AES Encryption)
-   **Wallet Protocol:** MetaMask integration

---

## 💻 Local Development Setup

### Prerequisites
-   [Node.js](https://nodejs.org/) (v18+ recommended)
-   [MetaMask](https://metamask.io/) browser extension
-   [Hedera Testnet Account](https://portal.hedera.com/register) (configured in MetaMask via Hashio RPC)
-   [Pinata Account](https://pinata.cloud/) (for IPFS API keys)

### 1. Clone the Repository
```bash
git clone https://github.com/Yashwanth112004/Hedera-APEX-Hackathon.git
cd Hedera-APEX-Hackathon
```

### 2. Configure Smart Contracts
```bash
# Install hardhat dependencies
npm install

# Create environment file
touch .env
```
Add the following to your `.env` file:
```env
PRIVATE_KEY="your_hedera_testnet_private_key"
```

Compile and deploy contracts (Optional, addresses are already configured in frontend):
```bash
npx hardhat compile
npx hardhat run scripts/deploy_registry.js --network hedera_testnet
# Repeat for other deployment scripts if deploying fresh instances
```

### 3. Configure Frontend
```bash
cd frontend
npm install

# Create frontend environment file
touch .env
```
Add your Pinata API JWT to the frontend `.env`:
```env
VITE_PINATA_JWT="your_pinata_jwt_token_here"
```

### 4. Run the Application
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. Connect MetaMask to the **Hedera Testnet**.

---

## 📖 Walkthrough & Testing

1.  **Patient Flow:** Login as a Patient. Register a Short ID. You can see your active consents, medical records, and inbound data requests.
2.  **Lab Flow:** Login as a Lab via a different browser/profile. Upload a mock blood test securely using the Patient's Short ID. This triggers AES encryption, IPFS storage, and on-chain record mapping.
3.  **Doctor Flow:** Login as a Doctor. Request access to the Patient's records. Wait for the Patient to approve via their dashboard. Once approved, pull the IPFS CID and decrypt the blood test natively in the browser. Issue a prescription to the Global Queue.
4.  **Pharmacy Flow:** Login as a Pharmacy. Scan the public queue. Request access to dispense the medication. Wait for Patient approval. Click `Decrypt & Dispense`.

Detailed feature breakdowns can be found in our internal `walkthrough.md` artifacts.

---
