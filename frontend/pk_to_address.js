import { ethers } from "ethers";

const pk = "0xa4ae27ce1030b81e1ee9ea47ad61154de36631471f58599d0d58c432d43151bd";
const wallet = new ethers.Wallet(pk);
console.log("Wallet address from .env PK:", wallet.address);
