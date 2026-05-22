// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Faucet {
    address public owner;
    uint256 public constant DRIP_AMOUNT = 0.01 ether;
    uint256 public constant COOLDOWN = 1 days;

    mapping(address => uint256) public nextRequestAt;

    event Deposited(address indexed from, uint256 amount);
    event FundsSent(address indexed to, uint256 amount);
    event OwnerWithdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function deposit() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function requestFunds() external {
        require(block.timestamp >= nextRequestAt[msg.sender], "Try later");
        require(address(this).balance >= DRIP_AMOUNT, "Faucet empty");

        nextRequestAt[msg.sender] = block.timestamp + COOLDOWN;
        (bool ok, ) = payable(msg.sender).call{value: DRIP_AMOUNT}("");
        require(ok, "Transfer failed");

        emit FundsSent(msg.sender, DRIP_AMOUNT);
    }

    function ownerWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool ok, ) = payable(owner).call{value: amount}("");
        require(ok, "Withdraw failed");
        emit OwnerWithdrawn(owner, amount);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}