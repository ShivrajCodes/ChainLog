// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

contract LogIntegrity {

    struct LogRecord {
        bytes32 fileHash;
        uint256 timestamp;
        string fileName;
        string machineId;
        address owner;
    }

    // recordId => LogRecord
    mapping(bytes32 => LogRecord) public records;

    // user => list of recordIds
    mapping(address => bytes32[]) public userRecords;

    event LogStored(
        bytes32 indexed recordId,
        address indexed owner,
        bytes32 fileHash,
        uint256 timestamp
    );

    // Store log hash
    function storeLog(
        bytes32 _fileHash,
        uint256 _timestamp,
        string calldata _fileName,
        string calldata _machineId
    ) external {

        // unique ID
        bytes32 recordId = keccak256(
            abi.encodePacked(msg.sender, _timestamp, _fileHash)
        );

        require(records[recordId].timestamp == 0, "Already exists");

        records[recordId] = LogRecord({
            fileHash: _fileHash,
            timestamp: _timestamp,
            fileName: _fileName,
            machineId: _machineId,
            owner: msg.sender
        });

        userRecords[msg.sender].push(recordId);

        emit LogStored(recordId, msg.sender, _fileHash, _timestamp);
    }

    // Get one record
    function getRecord(bytes32 _recordId)
        external
        view
        returns (LogRecord memory)
    {
        return records[_recordId];
    }

    // Get all records of caller
    function getMyRecords() external view returns (bytes32[] memory) {
        return userRecords[msg.sender];
    }
}