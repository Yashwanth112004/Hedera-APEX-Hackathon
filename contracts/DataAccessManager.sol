// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ConsentManager.sol";
import "./AuditLog.sol";

contract DataAccessManager {

    ConsentManager public consentManager;
    AuditLog public audit;

    constructor(address _consentManager, address _audit) {
        consentManager = ConsentManager(_consentManager);
        audit = AuditLog(_audit);
    }

    function accessData(
        address _principal,
        uint256 index,
        string memory purpose
    ) external {

        bool valid = consentManager.validateConsent(_principal, index);
        require(valid, "Invalid or expired consent");

        audit.logDataAccessed(_principal, msg.sender, purpose, block.timestamp);
    }
}