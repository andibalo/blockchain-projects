// Web3 API Layer 2: Contract — binds SimpleNFT ABI + address for direct JS calls
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js";
import { NFT_ADDRESS, NFT_ABI } from "./config.js";
import { connectWallet, getStoredAddress, initWalletButton } from "./wallet.js";

// ── helpers ────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function setStatus(msg, type = "info") {
  const el = $("status-msg");
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}

// ── state ──────────────────────────────────────────────────────
let provider, signer, userAddress;

async function init() {
  initWalletButton({ onConnect: onWalletConnected });

  const stored = getStoredAddress();
  if (stored) {
    try {
      const w = await connectWallet();
      provider    = w.provider;
      signer      = w.signer;
      userAddress = w.address;
      await checkOwnerAccess();
    } catch {
      // will connect on button click
    }
  }
}

async function onWalletConnected(address) {
  const w = await connectWallet();
  provider    = w.provider;
  signer      = w.signer;
  userAddress = address;
  await checkOwnerAccess();
}

// Web3 API: read-only contract to call owner()
async function checkOwnerAccess() {
  try {
    const contract  = new ethers.Contract(NFT_ADDRESS, NFT_ABI, provider);
    const ownerAddr = await contract.owner();
    const isOwner   = userAddress.toLowerCase() === ownerAddr.toLowerCase();

    $("owner-panel")?.classList.toggle("hidden", !isOwner);
    $("not-owner-msg")?.classList.toggle("hidden", isOwner);

    if (isOwner) {
      await loadNFTStats();
    }
  } catch (err) {
    setStatus("Could not verify ownership: " + err.message, "error");
  }
}

async function loadNFTStats() {
  try {
    const contract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, provider);
    const [name, symbol] = await Promise.all([contract.name(), contract.symbol()]);
    const nameEl   = $("nft-name");
    const symbolEl = $("nft-symbol");
    if (nameEl)   nameEl.textContent   = name;
    if (symbolEl) symbolEl.textContent = symbol;
  } catch { /* non-critical */ }
}

// ── Mint NFT ───────────────────────────────────────────────────
async function mintNFT() {
  const recipientInput = $("recipient-address");
  const uriInput       = $("token-uri");

  const recipient = recipientInput?.value?.trim();
  const tokenUri  = uriInput?.value?.trim();

  if (!recipient || !ethers.isAddress(recipient)) {
    setStatus("Enter a valid recipient Ethereum address.", "warning");
    return;
  }
  if (!tokenUri) {
    setStatus("Enter a token URI (IPFS link or metadata URL).", "warning");
    return;
  }

  const btn = $("mint-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Minting…';
  setStatus("Waiting for MetaMask confirmation…", "info");

  try {
    if (!signer) {
      const w = await connectWallet();
      provider = w.provider; signer = w.signer; userAddress = w.address;
    }

    // Web3 API: write call — mintNFT(address to, string tokenUri)
    const contract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer);
    const tx = await contract.mintNFT(recipient, tokenUri);
    setStatus(`Transaction submitted: ${tx.hash.slice(0, 18)}…`, "info");

    // Wait for confirmation and parse the Transfer event to get the minted tokenId
    const receipt = await tx.wait(1);
    const tokenId = extractTokenId(receipt);

    setStatus(
      `NFT minted successfully! Token ID: ${tokenId ?? "see tx"}`,
      "success"
    );
    showMintedNFT(tokenId, recipient, tokenUri, receipt.hash);

    if (recipientInput) recipientInput.value = "";
    if (uriInput)       uriInput.value       = "";
  } catch (err) {
    const reason = err?.reason || err?.message || "Mint failed";
    setStatus(
      reason.includes("OwnableUnauthorizedAccount")
        ? "Only the contract owner can mint NFTs."
        : reason,
      "error"
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Mint NFT";
  }
}

// Parse Transfer event from receipt to get the minted token ID
function extractTokenId(receipt) {
  // Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
  // topic[0] = keccak256("Transfer(address,address,uint256)")
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  for (const log of receipt.logs) {
    if (log.topics[0] === transferTopic && log.topics[1] === ethers.zeroPadValue("0x00", 32)) {
      return BigInt(log.topics[3]).toString();
    }
  }
  return null;
}

function showMintedNFT(tokenId, recipient, uri, txHash) {
  const el = $("mint-result");
  if (!el) return;
  el.innerHTML = `
    <div class="alert alert-success mb-2">
      <strong>Minted!</strong> Token ID <span class="badge badge-green">${tokenId ?? "N/A"}</span>
      sent to <span class="font-mono">${recipient.slice(0, 8)}…${recipient.slice(-6)}</span>
    </div>
    <div class="tx-receipt">
      <a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank" rel="noopener">
        View on Etherscan ↗
      </a>
    </div>
  `;
  el.classList.remove("hidden");
}

// ── Wire up ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  init();
  $("mint-btn")?.addEventListener("click", mintNFT);
});
