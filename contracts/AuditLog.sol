// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AuditLog {

    event ConsentGranted(
        address indexed dataPrincipal,
        address indexed fiduciary,
        string purpose,
        uint256 expiry
    );

    event ConsentRevoked(
        address indexed dataPrincipal,
        address indexed fiduciary
    );

    event DataAccessed(
        address indexed dataPrincipal,
        address indexed fiduciary,
        string purpose,
        uint256 timestamp
    );

    event ErasureRequested(
        address indexed dataPrincipal,
        uint256 timestamp
    );

    struct ActionLog {
        address dataPrincipal;
        address dataFiduciary;
        string action;
        string purpose;
        uint256 timestamp;
    }

    ActionLog[] private allLogs;

    function logConsentGranted(
        address _principal,
        address _fiduciary,
        string memory _purpose,
        uint256 _expiry
    ) external {
        allLogs.push(ActionLog(_principal, _fiduciary, "Consent Granted", _purpose, block.timestamp));
        emit ConsentGranted(_principal, _fiduciary, _purpose, _expiry);
    }

    function logConsentRevoked(
        address _principal,
        address _fiduciary
    ) external {
        allLogs.push(ActionLog(_principal, _fiduciary, "Consent Revoked", "N/A", block.timestamp));
        emit ConsentRevoked(_principal, _fiduciary);
    }

    function logDataAccessed(
        address _principal,
        address _fiduciary,
        string memory _purpose,
        uint256 _timestamp
    ) external {
        allLogs.push(ActionLog(_principal, _fiduciary, "Data Accessed", _purpose, _timestamp));
        emit DataAccessed(_principal, _fiduciary, _purpose, _timestamp);
    }

    function logErasureRequested(
        address _principal,
        uint256 _timestamp
    ) external {
        allLogs.push(ActionLog(_principal, address(0), "Erasure Requested", "Right to be Forgotten", _timestamp));
        emit ErasureRequested(_principal, _timestamp);
    }

    function getLogs() external view returns (ActionLog[] memory) {
        return allLogs;
    }
}