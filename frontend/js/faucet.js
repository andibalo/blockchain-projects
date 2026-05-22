// Web3 API Layer 2: Contract — binds Faucet ABI + address for direct JS calls
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js";
import { FAUCET_ADDRESS, FAUCET_ABI, OWNER_ADDRESS } from "./config.js";
import { connectWallet, getStoredAddress, shortenAddress, initWalletButton } from "./wallet.js";

// ── helpers ────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function setStatus(msg, type = "info") {
  const el = $("status-msg");
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function formatEth(wei) {
  return parseFloat(ethers.formatEther(wei)).toFixed(4) + " ETH";
}

function formatCountdown(seconds) {
  if (seconds <= 0) return "Available now";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

// ── main init ──────────────────────────────────────────────────
let provider, signer, userAddress, faucetContract;

async function init() {
  initWalletButton({ onConnect: onWalletConnected });

  const stored = getStoredAddress();
  if (stored) {
    try {
      const w = await connectWallet();
      provider = w.provider;
      signer   = w.signer;
      userAddress = w.address;
      await loadFaucetData();
    } catch {
      // wallet not yet authorized — user must click Connect
    }
  }
}

async function onWalletConnected(address) {
  const w = await connectWallet();
  provider    = w.provider;
  signer      = w.signer;
  userAddress = address;
  await loadFaucetData();
}

// Web3 API: new ethers.Contract(address, abi, signerOrProvider)
function getFaucetContract(withSigner = false) {
  if (!provider) throw new Error("Wallet not connected");
  // Read-only uses provider; write calls use signer
  return new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, withSigner ? signer : provider);
}

async function loadFaucetData() {
  try {
    const contract = getFaucetContract();

    // Read contract state — these are pure view calls (no gas)
    const [balance, drip, cooldown, nextAt] = await Promise.all([
      contract.getBalance(),
      contract.DRIP_AMOUNT(),
      contract.COOLDOWN(),
      contract.nextRequestAt(userAddress),
    ]);

    const balanceEl = $("faucet-balance");
    const dripEl    = $("drip-amount");
    if (balanceEl) balanceEl.textContent = formatEth(balance);
    if (dripEl)    dripEl.textContent    = formatEth(drip);

    // Cooldown countdown
    const now      = Math.floor(Date.now() / 1000);
    const nextAtN  = Number(nextAt);
    updateCooldown(nextAtN, now);
    startCooldownTimer(nextAtN);

    // Show owner panel if connected wallet is the owner
    const ownerAddr = await contract.owner();
    if (userAddress.toLowerCase() === ownerAddr.toLowerCase()) {
      const ownerPanel = $("owner-panel");
      if (ownerPanel) ownerPanel.classList.remove("hidden");
    }
  } catch (err) {
    setStatus("Failed to load faucet data: " + err.message, "error");
  }
}

function updateCooldown(nextAt, now) {
  const el = $("cooldown-display");
  if (!el) return;
  const remaining = nextAt - now;
  el.textContent = formatCountdown(Math.max(0, remaining));

  const btn = $("request-btn");
  if (btn) btn.disabled = remaining > 0;
}

let countdownInterval;
function startCooldownTimer(nextAt) {
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    updateCooldown(nextAt, now);
    if (now >= nextAt) clearInterval(countdownInterval);
  }, 1000);
}

// ── Request Funds ──────────────────────────────────────────────
async function requestFunds() {
  const btn = $("request-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending…';
  setStatus("Waiting for MetaMask confirmation…", "info");

  try {
    if (!signer) {
      const w = await connectWallet();
      provider = w.provider; signer = w.signer; userAddress = w.address;
    }

    // Web3 API: contract call that writes to blockchain — MetaMask prompts user
    const contract = getFaucetContract(true);
    const tx = await contract.requestFunds();
    setStatus(`Transaction submitted: ${tx.hash.slice(0, 18)}…`, "info");

    // Wait for tx to be mined (1 confirmation)
    const receipt = await tx.wait(1);
    setStatus(`Success! Received 0.01 ETH. Tx: ${receipt.hash}`, "success");

    showTxReceipt(receipt.hash);
    await loadFaucetData();
  } catch (err) {
    const msg = err?.reason || err?.message || "Transaction failed";
    setStatus(msg.includes("Try later") ? "Cooldown active — please wait." : msg, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Request Test ETH";
  }
}

// ── Deposit (owner) ────────────────────────────────────────────
async function deposit() {
  const amountInput = $("deposit-amount");
  const amount = amountInput?.value?.trim();
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    setStatus("Enter a valid ETH amount to deposit.", "warning");
    return;
  }

  const btn = $("deposit-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Depositing…';

  try {
    if (!signer) {
      const w = await connectWallet();
      provider = w.provider; signer = w.signer; userAddress = w.address;
    }

    // Web3 API: payable contract call — sends ETH with the call
    const contract = getFaucetContract(true);
    const tx = await contract.deposit({ value: ethers.parseEther(amount) });
    setStatus("Transaction submitted…", "info");

    const receipt = await tx.wait(1);
    setStatus(`Deposited ${amount} ETH successfully!`, "success");
    showTxReceipt(receipt.hash);
    if (amountInput) amountInput.value = "";
    await loadFaucetData();
  } catch (err) {
    setStatus(err?.reason || err?.message || "Deposit failed", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Deposit";
  }
}

function showTxReceipt(hash) {
  const el = $("tx-receipt");
  if (!el) return;
  el.innerHTML = `
    <span class="text-muted">Tx: </span>
    <a href="https://sepolia.etherscan.io/tx/${hash}" target="_blank" rel="noopener">
      ${hash}
    </a>`;
  el.classList.remove("hidden");
}

// ── Wire up buttons ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  init();
  $("request-btn")?.addEventListener("click", requestFunds);
  $("deposit-btn")?.addEventListener("click", deposit);
});
