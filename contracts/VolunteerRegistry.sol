// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract VolunteerRegistry {

    struct Volunteer {
        string cid;
        bool active;
    }

    mapping(bytes32 => Volunteer) public volunteers;

    event VolunteerAdded(bytes32 hashId,string cid);
    event StatusUpdated(bytes32 hashId,bool active);

    function addVolunteer(
        bytes32 hashId,
        string memory cid
    ) external {

        volunteers[hashId] = Volunteer(
            cid,
            true
        );

        emit VolunteerAdded(hashId,cid);
    }

    function updateStatus(
        bytes32 hashId,
        bool active
    ) external {

        volunteers[hashId].active = active;

        emit StatusUpdated(hashId,active);
    }

    function getVolunteer(
        bytes32 hashId
    ) external view returns(
        string memory cid,
        bool active
    ){
        Volunteer memory v = volunteers[hashId];
        return (v.cid,v.active);
    }
}