// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./DataFiduciaryRegistry.sol";
import "./AuditLog.sol";

contract ConsentManager {

    struct Consent {
        address dataPrincipal;
        address dataFiduciary;
        string purpose;
        string dataHash;
        uint256 grantedAt;
        uint256 expiry;
        bool isActive;
        bool erased;
    }

    struct AccessRequest {
        uint256 id;
        address provider;
        string purpose;
        uint256 timestamp;
        bool isPending;
    }

    mapping(address => Consent[]) private consents;
    mapping(address => AccessRequest[]) private accessRequests;
    uint256 private requestCounter;

    DataFiduciaryRegistry public registry;
    AuditLog public audit;

    constructor(address _registry, address _audit) {
        registry = DataFiduciaryRegistry(_registry);
        audit = AuditLog(_audit);
    }

    function grantConsent(
        address _fiduciary,
        string memory _purpose,
        string memory _dataHash,
        uint256 _durationInSeconds
    ) external {

        require(registry.isApproved(_fiduciary), "Fiduciary not approved");

        uint256 expiryTime = block.timestamp + _durationInSeconds;

        consents[msg.sender].push(
            Consent(
                msg.sender,
                _fiduciary,
                _purpose,
                _dataHash,
                block.timestamp,
                expiryTime,
                true,
                false
            )
        );

        audit.logConsentGranted(msg.sender, _fiduciary, _purpose, expiryTime);
    }

    function revokeConsent(uint256 index) external {
        Consent storage consent = consents[msg.sender][index];
        require(consent.isActive, "Already revoked");

        consent.isActive = false;

        audit.logConsentRevoked(msg.sender, consent.dataFiduciary);
    }

    function requestErasure(uint256 index) external {
        Consent storage consent = consents[msg.sender][index];
        consent.erased = true;

        audit.logErasureRequested(msg.sender, block.timestamp);
    }

    function getPatientConsents(address _patient) external view returns (Consent[] memory) {
        return consents[_patient];
    }

    function validateConsent(
        address _principal,
        uint256 index
    ) external view returns (bool) {
        Consent memory consent = consents[_principal][index];

        if (
            consent.isActive &&
            !consent.erased &&
            block.timestamp <= consent.expiry
        ) {
            return true;
        }

        return false;
    }

    // --- NEW: Inbound Provider Access Requests ---

    function requestAccess(address _patient, string memory _purpose) external {
        // Bypassed for Prototype Demo to allow any tester's wallet to act as Fiduciary
        // require(registry.isApproved(msg.sender), "Caller is not an approved fiduciary");

        requestCounter++;
        accessRequests[_patient].push(AccessRequest({
            id: requestCounter,
            provider: msg.sender,
            purpose: _purpose,
            timestamp: block.timestamp,
            isPending: true
        }));

        // Log the formal request on-chain
        audit.logDataAccessed(_patient, msg.sender, string(abi.encodePacked("Requested access for: ", _purpose)), block.timestamp);
    }

    function getPendingRequests(address _patient) external view returns (AccessRequest[] memory) {
        // Return all requests for the caller (patient) that are still pending
        uint256 count = 0;
        for (uint256 i = 0; i < accessRequests[_patient].length; i++) {
            if (accessRequests[_patient][i].isPending) {
                count++;
            }
        }

        AccessRequest[] memory pending = new AccessRequest[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < accessRequests[_patient].length; i++) {
            if (accessRequests[_patient][i].isPending) {
                pending[idx] = accessRequests[_patient][i];
                idx++;
            }
        }
        return pending;
    }

    // Patient approves a specific pending request
    function approveRequest(
        uint256 _requestId,
        string memory _dataHash, // Optional, can be empty if mapping via MedicalRecords
        uint256 _durationInSeconds
    ) external {
        
        // Find the request
        int256 foundIdx = -1;
        for (uint256 i = 0; i < accessRequests[msg.sender].length; i++) {
            if (accessRequests[msg.sender][i].id == _requestId && accessRequests[msg.sender][i].isPending) {
                foundIdx = int256(i);
                break;
            }
        }
        
        require(foundIdx != -1, "Pending request not found");
        
        AccessRequest storage req = accessRequests[msg.sender][uint256(foundIdx)];
        req.isPending = false; // Mark resolved

        // Automatically grant consent
        uint256 expiryTime = block.timestamp + _durationInSeconds;

        consents[msg.sender].push(
            Consent(
                msg.sender,
                req.provider,
                req.purpose,
                _dataHash,
                block.timestamp,
                expiryTime,
                true,
                false
            )
        );

        audit.logConsentGranted(msg.sender, req.provider, req.purpose, expiryTime);
    }

    function rejectRequest(uint256 _requestId) external {
        for (uint256 i = 0; i < accessRequests[msg.sender].length; i++) {
            if (accessRequests[msg.sender][i].id == _requestId && accessRequests[msg.sender][i].isPending) {
                accessRequests[msg.sender][i].isPending = false;
                break;
            }
        }
    }
}