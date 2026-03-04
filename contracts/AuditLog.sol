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

    function logConsentGranted(
        address _principal,
        address _fiduciary,
        string memory _purpose,
        uint256 _expiry
    ) external {
        emit ConsentGranted(_principal, _fiduciary, _purpose, _expiry);
    }

    function logConsentRevoked(
        address _principal,
        address _fiduciary
    ) external {
        emit ConsentRevoked(_principal, _fiduciary);
    }

    function logDataAccessed(
        address _principal,
        address _fiduciary,
        string memory _purpose,
        uint256 _timestamp
    ) external {
        emit DataAccessed(_principal, _fiduciary, _purpose, _timestamp);
    }

    function logErasureRequested(
        address _principal,
        uint256 _timestamp
    ) external {
        emit ErasureRequested(_principal, _timestamp);
    }
}