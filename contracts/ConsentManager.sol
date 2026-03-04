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

    mapping(address => Consent[]) private consents;

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

    function getMyConsents() external view returns (Consent[] memory) {
        return consents[msg.sender];
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
}