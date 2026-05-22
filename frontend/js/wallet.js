// Web3 API Layer 1: BrowserProvider — wraps MetaMask's window.ethereum
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js";
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from "./config.js";

export function shortenAddress(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install it from metamask.io");
  }

  // Request account access
  await window.ethereum.request({ method: "eth_requestAccounts" });

  // Web3 API: BrowserProvider wraps window.ethereum
  const provider = new ethers.BrowserProvider(window.ethereum);
  const network  = await provider.getNetwork();

  if (Number(network.chainId) !== REQUIRED_CHAIN_ID) {
    // Ask MetaMask to switch to Sepolia
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + REQUIRED_CHAIN_ID.toString(16) }],
      });
    } catch {
      throw new Error(
        `Wrong network. Please switch MetaMask to ${REQUIRED_CHAIN_NAME} (chainId ${REQUIRED_CHAIN_ID}).`
      );
    }
  }

  // Web3 API: Signer — the connected wallet that can sign transactions
  const signer  = await provider.getSigner();
  const address = await signer.getAddress();

  sessionStorage.setItem("connectedAddress", address);
  return { provider, signer, address };
}

export function getStoredAddress() {
  return sessionStorage.getItem("connectedAddress") || null;
}

export function disconnectWallet() {
  sessionStorage.removeItem("connectedAddress");
}

// Call this on every page to wire up the "Connect Wallet" button in the nav
export function initWalletButton({ onConnect } = {}) {
  const btn     = document.getElementById("connect-btn");
  const display = document.getElementById("wallet-address");
  if (!btn) return;

  const stored = getStoredAddress();
  if (stored) {
    btn.textContent = "Connected";
    btn.classList.add("btn-success");
    btn.classList.remove("btn-outline");
    if (display) display.textContent = shortenAddress(stored);
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Connecting…';
    try {
      const { address } = await connectWallet();
      btn.textContent = "Connected";
      btn.classList.add("btn-success");
      btn.classList.remove("btn-outline");
      if (display) display.textContent = shortenAddress(address);
      if (onConnect) onConnect(address);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Connect Wallet";
      showGlobalError(err.message);
    }
  });

  // React to account changes from MetaMask
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
        btn.textContent = "Connect Wallet";
        btn.classList.remove("btn-success");
        btn.classList.add("btn-outline");
        if (display) display.textContent = "";
      } else {
        sessionStorage.setItem("connectedAddress", accounts[0]);
        if (display) display.textContent = shortenAddress(accounts[0]);
      }
    });
  }
}

function showGlobalError(msg) {
  let el = document.getElementById("global-error");
  if (!el) {
    el = document.createElement("div");
    el.id = "global-error";
    el.className = "alert alert-error";
    el.style.cssText = "position:fixed;top:72px;right:1.5rem;max-width:380px;z-index:999";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 6000);
}
