// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./AccessControl.sol";

contract DataFiduciaryRegistry is AccessControl {

    struct Fiduciary {
        string name;
        string licenseId;
        bool approved;
        bool suspended;
    }

    mapping(address => Fiduciary) public fiduciaries;

    event FiduciaryRegistered(address indexed fiduciary);
    event FiduciaryApproved(address indexed fiduciary);
    event FiduciarySuspended(address indexed fiduciary);

    function registerFiduciary(string memory _name, string memory _licenseId) external {
        fiduciaries[msg.sender] = Fiduciary(_name, _licenseId, false, false);
        emit FiduciaryRegistered(msg.sender);
    }

    function approveFiduciary(address _fiduciary) external onlyAdmin {
        fiduciaries[_fiduciary].approved = true;
        emit FiduciaryApproved(_fiduciary);
    }

    function suspendFiduciary(address _fiduciary) external onlyAdmin {
        fiduciaries[_fiduciary].suspended = true;
        emit FiduciarySuspended(_fiduciary);
    }

    function isApproved(address _fiduciary) public view returns (bool) {
        return fiduciaries[_fiduciary].approved && !fiduciaries[_fiduciary].suspended;
    }
}