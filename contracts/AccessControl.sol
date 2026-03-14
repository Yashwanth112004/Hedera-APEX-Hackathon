// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AccessControl {
    address public superAdmin;
    mapping(address => bool) public admins;

    constructor() {
        superAdmin = msg.sender;
        admins[msg.sender] = true;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }

    function addAdmin(address _admin) external onlyAdmin {
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) external onlyAdmin {
        admins[_admin] = false;
    }
}