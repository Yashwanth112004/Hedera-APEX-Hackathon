// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract HealthcareRBAC {
    mapping(address => bool) public admins;
    mapping(address => uint8) public roles;

    event RoleAssigned(address indexed user, uint8 role);
    event RoleUpdated(address indexed user, uint8 role);

    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admin allowed");
        _;
    }

    constructor() {
        admins[msg.sender] = true;
    }

    function addAdmin(address newAdmin) public onlyAdmin {
        admins[newAdmin] = true;
    }

    function isAdmin(address wallet) public view returns(bool){
        return admins[wallet];
    }

    function registerRole(address user, uint8 role) public onlyAdmin {
        require(user != address(0), "Invalid user address");
        roles[user] = role;
        emit RoleAssigned(user, role);
    }

    function updateRole(address user, uint8 role) public onlyAdmin {
        require(user != address(0), "Invalid user address");
        roles[user] = role;
        emit RoleUpdated(user, role);
    }

    function getRole(address wallet) public view returns(uint8){
        return roles[wallet];
    }
}