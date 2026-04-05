# Industrial Integrity System

**Tamper-Proof Logging using Blockchain**

---

## Overview

The Industrial Integrity System is a blockchain-based solution designed to ensure the authenticity and integrity of industrial machine logs.

In traditional systems, logs can be modified after generation, leading to false reporting, lack of accountability, and potential financial or safety risks. This project eliminates that problem by making log data tamper-evident using cryptographic hashing and blockchain technology.

---

## Problem Statement

In industrial environments, machines generate logs continuously — recording parameters like temperature, RPM, vibration levels, and overall health status. However, operators or administrators can alter past logs to avoid responsibility or cover up failures.

This leads to serious consequences:

- Loss of accountability across teams
- Incorrect root cause analysis during investigations
- Fraudulent or misleading compliance reports

There is a clear need for a system where log data, once generated, cannot be silently modified.

---

## Our Solution

This system ensures that once a log is generated, any attempt to modify it can be detected instantly.

We achieve this by:

- Generating logs in real-time from simulated industrial sensors
- Converting each log into a cryptographic hash (a unique digital fingerprint)
- Storing those hashes permanently on the blockchain
- Allowing users to verify integrity by uploading a log file and comparing its hash against the stored record

---

## How It Works

### Step 1 — Log Generation (Mimicker)

The system simulates industrial machine data every 10 seconds. Each reading captures temperature, RPM, vibration, and a computed health status based on threshold analysis.

### Step 2 — JSON File Creation

Each telemetry snapshot is packaged as a downloadable JSON file. For example:

```json
{
  "temperature": 95,
  "rpm": 2100,
  "vibration": 4.3,
  "health": "WARNING",
  "timestamp": "2026-04-04T04:18:59.815Z"
}
```

### Step 3 — Hash Generation

The JSON data is converted into a SHA-256 hash using the Web Crypto API. Even a single character change in the data produces an entirely different hash, making tampering immediately obvious.

### Step 4 — Blockchain Storage

The hash, along with metadata like the file name, machine ID, and timestamp, is stored on-chain via a smart contract deployed on the Celo Sepolia testnet. Once written, this data is immutable and publicly verifiable.

### Step 5 — Verification (Checker)

When a user uploads a previously exported log file, the system recomputes its hash and searches the caller's on-chain records for a match.

### Step 6 — Result

- **Authentic** — The file hash matches a blockchain record. The data has not been altered.
- **Tampered** — No matching hash was found. The file has been modified since it was originally generated.

---

## Key Features

- Real-time telemetry simulation with configurable emission intervals
- Automatic JSON log generation and local file export
- Blockchain-based hash storage using a custom Solidity smart contract
- Tampering detection through cryptographic comparison
- MetaMask wallet integration for signing and broadcasting transactions
- Google OAuth authentication via Firebase
- A clean, storytelling-style dashboard built with React and Tailwind CSS

---

## Tech Stack

- **Frontend:** React (Vite) with Tailwind CSS
- **Blockchain:** Solidity smart contract deployed on Celo Sepolia, interacted with via ABI
- **Web3 Integration:** ethers.js v6
- **Authentication:** Firebase (Google OAuth)
- **Wallet:** MetaMask

---

## Core Concept

The entire system is built on three principles:

1. **Cryptographic Hashing** — Each log gets a unique digital fingerprint. Any change to the data, no matter how small, produces a completely different fingerprint.
2. **Blockchain Immutability** — Once a hash is stored on-chain, it cannot be altered or deleted by anyone.
3. **Verification Mechanism** — By recomputing the hash of an uploaded file and comparing it against the blockchain record, we can definitively say whether the data has been tampered with.

---

## Use Cases

- Industrial monitoring and predictive maintenance systems
- Audit trails and regulatory compliance tracking
- IoT sensor data integrity verification
- Secure logging frameworks for critical infrastructure

---

## Project Flow

```
Telemetry Simulator (UI)
       |
       v
Generate Log --> Compute SHA-256 Hash
       |
       v
Store Hash + Metadata on Blockchain
       |
       v
User Uploads File (Integrity Checker)
       |
       v
Recompute Hash and Compare with On-Chain Record
       |
       v
Result: Authentic or Tampered
```

---

## Future Enhancements

- Multi-machine and multi-sensor support
- AI-based failure prediction from telemetry trends
- Batch log processing for bulk verification
- Real-time alert system for critical threshold breaches
- Advanced analytics dashboard with historical reporting

---

## Special Acknowledgement

The blockchain infrastructure and smart contract logic powering this system are based on the [ChainLog](https://github.com/Nilanjan-Mondal/ChainLog) project.

We would like to extend our sincere appreciation to **Nilanjan Mondal** for designing and implementing the underlying smart contract architecture. His contribution forms the backbone of the blockchain layer in this project.

- Project Repository: [github.com/Nilanjan-Mondal/ChainLog](https://github.com/Nilanjan-Mondal/ChainLog)
- GitHub Profile: [github.com/Nilanjan-Mondal](https://github.com/Nilanjan-Mondal)

The smart contract is deployed and tested on the Celo Sepolia test network, enabling a secure and efficient environment for tamper-proof log storage and verification.

---

## Final Thought

> "In a world where data can be manipulated, we ensure that the truth remains immutable."
