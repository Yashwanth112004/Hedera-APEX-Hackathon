// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./DataFiduciaryRegistry.sol";
import "./AuditLog.sol";

contract MedicalRecords {
    struct Record {
        uint256 id;
        address patient;
        address provider; // Who uploaded it
        string cid;       // IPFS Hash
        string recordType; // e.g., "Lab Report", "Prescription"
        uint256 timestamp;
        uint256 billAmount; // Fee or fulfillment cost
    }

    struct PrescriptionQueueItem {
        uint256 recordId;
        address patient;
        string patientName;
        string cid;
        bool isDispensed;
        uint256 billAmount;
    }

    PrescriptionQueueItem[] public prescriptionQueue;

    // Mapping from patient address to their records
    mapping(address => Record[]) private patientRecords;
    uint256 private recordCounter;

    DataFiduciaryRegistry public registry;
    AuditLog public audit;

    event RecordAdded(
        uint256 indexed recordId,
        address indexed patient,
        address indexed provider,
        string cid,
        string recordType,
        uint256 timestamp
    );

    event PrescriptionAddedToQueue(
        uint256 indexed recordId,
        address indexed patient,
        string patientName
    );

    event PrescriptionDispensed(
        uint256 indexed recordId,
        uint256 billAmount
    );

    constructor(address _registry, address _audit) {
        registry = DataFiduciaryRegistry(_registry);
        audit = AuditLog(_audit);
    }

    // Only approved fiduciaries (Labs, Doctors, etc.) can map a CID to a patient
    function addRecord(
        address _patient,
        string memory _cid,
        string memory _recordType,
        uint256 _billAmount // Added cost field
    ) external {
        // Bypassed for Prototype Demo to allow any tester's wallet to act as Fiduciary
        // require(registry.isApproved(msg.sender), "Caller is not an approved fiduciary");

        recordCounter++;
        
        patientRecords[_patient].push(Record({
            id: recordCounter,
            patient: _patient,
            provider: msg.sender,
            cid: _cid,
            recordType: _recordType,
            timestamp: block.timestamp,
            billAmount: _billAmount // Updated from hardcoded 0
        }));

        // Log this action to the global audit trail
        // We can reuse DataAccessed or we might need a new event on AuditLog if we want,
        // but for now we emit locally and can log string descriptions.
        audit.logDataAccessed(_patient, msg.sender, string(abi.encodePacked("Uploaded new ", _recordType)), block.timestamp);
        
        emit RecordAdded(recordCounter, _patient, msg.sender, _cid, _recordType, block.timestamp);
    }

    function addPrescription(
        address _patient,
        string memory _patientName,
        string memory _cid
    ) external {
        recordCounter++;
        
        prescriptionQueue.push(PrescriptionQueueItem({
            recordId: recordCounter,
            patient: _patient,
            patientName: _patientName,
            cid: _cid,
            isDispensed: false,
            billAmount: 0
        }));

        // ADDED: Also add to the patient's record history so it's visible in insurance/patient portal
        patientRecords[_patient].push(Record({
            id: recordCounter,
            patient: _patient,
            provider: msg.sender,
            cid: _cid,
            recordType: "Prescription",
            timestamp: block.timestamp,
            billAmount: 0
        }));

        audit.logDataAccessed(_patient, msg.sender, "Uploaded new Prescription to Global Queue", block.timestamp);
        emit PrescriptionAddedToQueue(recordCounter, _patient, _patientName);
    }

    function getPendingPrescriptions() external view returns (PrescriptionQueueItem[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < prescriptionQueue.length; i++) {
            if (!prescriptionQueue[i].isDispensed) {
                count++;
            }
        }

        PrescriptionQueueItem[] memory pending = new PrescriptionQueueItem[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < prescriptionQueue.length; i++) {
            if (!prescriptionQueue[i].isDispensed) {
                pending[index] = prescriptionQueue[i];
                index++;
            }
        }
        return pending;
    }

    function markPrescriptionDispensed(uint256 _recordId, uint256 _billAmount) external {
        for (uint256 i = 0; i < prescriptionQueue.length; i++) {
            if (prescriptionQueue[i].recordId == _recordId) {
                prescriptionQueue[i].isDispensed = true;
                prescriptionQueue[i].billAmount = _billAmount;
                
                // Update the patient's record history with the bill amount
                address patient = prescriptionQueue[i].patient;
                for (uint256 j = 0; j < patientRecords[patient].length; j++) {
                    if (patientRecords[patient][j].id == _recordId) {
                        patientRecords[patient][j].billAmount = _billAmount;
                        break;
                    }
                }
                
                emit PrescriptionDispensed(_recordId, _billAmount);
                break;
            }
        }
    }

    // Patients use this to fetch all CIDs mapped to their wallet
    function getPatientRecords(address _patient) external view returns (Record[] memory) {
        return patientRecords[_patient];
    }
}
