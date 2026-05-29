// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/access/Ownable.sol";

contract SimpleNFT is ERC721URIStorage, Ownable {
    uint256 private nextTokenId = 1;

    constructor() ERC721("SimpleNFT", "SNFT") Ownable(msg.sender) {}

    function mintNFT(address to, string calldata tokenUri) external onlyOwner returns (uint256) {
        uint256 tokenId = nextTokenId;
        unchecked { nextTokenId += 1; }

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);

        return tokenId;
    }
}