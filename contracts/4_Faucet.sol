// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

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
        payable(msg.sender).transfer(DRIP_AMOUNT);

        emit FundsSent(msg.sender, DRIP_AMOUNT);
    }

    function ownerWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(owner).transfer(amount);
        emit OwnerWithdrawn(owner, amount);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}