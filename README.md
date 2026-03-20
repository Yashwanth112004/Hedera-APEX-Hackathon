# 🏥 Hedera Healthcare Consent Network (DPDP Compliant)

A state-of-the-art Decentralized Healthcare Data Governance platform built on **Hedera Hashgraph**. This platform is designed to be fully compliant with the **Digital Personal Data Protection (DPDP) Act 2023**, ensuring that patients have absolute control over their medical data while enabling seamless, secure interoperability between healthcare providers.

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)](https://orochi-genshin11187.vercel.app)
[![Hedera Testnet](https://img.shields.io/badge/Hedera-Testnet-blue?style=flat-square)](https://portal.hedera.com/)

---

## 🌟 Core Value Proposition

In the traditional healthcare system, patient data is siloed, and privacy is often secondary. Our platform solves this by:
- **Patient Sovereignty**: Patients own their data and explicitly grant/revoke access.
- **Immutable Auditing**: Every data interaction is logged on the Hedera ledger, providing a transparent "who, when, and why" for every access event.
- **DPDP Compliance**: Built-in mechanisms for **Notice & Consent (Section 5/6)**, **Right to Erasure (Section 12)**, and **Right to Nominate (Section 10)**.
- **Interoperability**: A unified network linking Hospitals, Doctors, Labs, Pharmacies, and Insurers.

---

## 🏗️ System Architecture

The project follows a modular architecture connecting a React-based frontend to secure Ethereum-compatible smart contracts on the Hedera Testnet.

### 🔐 Multi-Role Dashboard System
The platform features specialized portals for every actor in the healthcare ecosystem:

| Role | Responsibility | Core Features |
| :--- | :--- | :--- |
| **Patient** | Data Principal | Manage Records, Grant/Revoke Consent, Nominate Beneficiaries, Right to Erasure, Insurance Claims. |
| **Hospital** | Data Fiduciary | Upload Clinical Records, Request Access, Emergency "Break-Glass" Access. |
| **Doctor** | Data Fiduciary | View Authorized Medical History, Request Patient Data for Diagnosis. |
| **Lab** | Data Fiduciary | Upload Diagnostic Reports, Request Specialized Access. |
| **Pharmacy** | Data Fiduciary | View Authorized Prescriptions, Mark as Dispensed (Consent-locked). |
| **Insurance**| Data Fiduciary | Process Claims, Verify Clinical Evidence, Disburse Funds in HBAR. |
| **Admin** | Network Governance | Manage RBAC (Roles), Approve Fiduciaries in the National Registry. |
| **Auditor** | Compliance | Monitor global network logs for transparency and regulatory oversight. |

---

## 🔌 Smart Contract Layer

The backend logic is decentralized and powered by several interconnected Solidity contracts:

1. **`ConsentManager.sol`**: The heart of the platform. Manages the lifecycle of consents and access requests.
2. **`AuditLog.sol`**: An immutable ledger that records all `DataAccessed`, `ConsentGranted`, and `AccessRequested` events.
3. **`MedicalRecords.sol`**: Stores pointers (IPFS CIDs) to encrypted clinical data and prescription states.
4. **`DataFiduciaryRegistry.sol`**: A whitelist of approved healthcare providers, ensuring only verified entities can request data.
5. **`RBAC.sol`**: Role-Based Access Control that defines permissions for each wallet address.
6. **`WalletMapper.sol`**: Maps long Hedera addresses to user-friendly "Short IDs" (e.g., `123-ABC`).

---

## 📂 Project Structure & Routing

### Frontend (`/frontend/src`)
- **`App.jsx`**: Main entry point handling wallet connection, authentication (Digital Signature), contract initialization, and Role-Based routing.
- **`/pages`**: Contains all dashboard components (`PatientDashboard`, `InsuranceDashboard`, etc.).
- **`/utils`**: Helper functions for IPFS (Pinata), Hedera interactions, and ID resolution.
- **`/components`**: Reusable UI elements (Navbar, Sidebar, DPDP Notices).

### Contract Information
- **Network**: Hedera Testnet
- **Consensus**: Hedera Token Service (HTS) & Hedera Smart Contract Service (HSCS)
- **Encryption**: AES-256 for medical data before IPFS upload.

---

## 🚀 Key Features Walkthrough

### 1. DPDP Right to Erasure (Section 12)
Patients can trigger a "Universal Erasure Protocol" which revokes all active consents and sends formal on-chain requests to all clinical entities to purge their data, ensuring the "Right to be Forgotten."

### 2. Emergency "Break-Glass" Access
In critical scenarios where a patient is unconscious, authorized hospitals can bypass standard consent. However, this action triggers a **high-priority Red Alert** log on the blockchain and notifies the patient/beneficiaries immediately.

### 3. Transparent Insurance Claims
Patients can submit CIDs of clinical records directly to insurers. The system distinguishes between "Processing" (authorized) and "Claimed" (funds disbursed via HBAR transfer), with all steps verifiable on-chain.

### 4. Beneficiary Management
Patients can nominate up to 2 trusted individuals (e.g., family members) who can log in and manage consents or access data on their behalf, ensuring continuity of care.

---

## 🛠️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd hedera-healthcare-network
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root and migrations folders:
   ```env
   VITE_PINATA_API_KEY=your_key
   VITE_PINATA_SECRET=your_secret
   PRIVATE_KEY=your_hedera_testnet_private_key
   ```

3. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

4. **Launch Development Server**
   ```bash
   npm run dev
   ```

---

## 🛡️ Security & Privacy
- **No Data on Chain**: Medical data is NEVER stored on the blockchain. Only encrypted IPFS CIDs are stored.
- **Client-Side Encryption**: Data is encrypted using the patient's keys before it ever leaves their browser.
- **Admin restricted**: Administrative functions (like approving insurers) are restricted to hardcoded multi-sig or governance wallets.

---

*This project was developed for the Hedera Ecosystem to showcase the power of DLT in solving real-world privacy challenges in the healthcare sector.*
