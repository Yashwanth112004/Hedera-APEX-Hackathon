import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Scanner } from "@yudiel/react-qr-scanner";
import axios from "axios";
import CryptoJS from "crypto-js";
import VolunteerRegister from "./VolunteerRegister";

/* CONTRACT ADDRESSES */

const CONSENT_MANAGER = "0x9f235ce7634fE3aB4B3AbD16afBFe7C242C77296";
const REGISTRY = "0xb54F86cb9a87f4F8c27915c9820e2a4D48221Db2";
const ACCESS_MANAGER = "0xa072a469aFE0361983f59681E527A5cB53F38414";
const VOLUNTEER_REGISTRY = "0x79a758403F92c9E5597a4484d9d9bd2055Da8c55";

/* ABIs */

const volunteerABI = [
  "function getVolunteer(bytes32) view returns(string,bool)"
];

const consentABI = [
  "function grantConsent(address,string,string,uint256)",
  "function revokeConsent(uint256)",
  "function requestErasure(uint256)",
  "function getMyConsents() view returns (tuple(address dataPrincipal,address dataFiduciary,string purpose,string dataHash,uint256 grantedAt,uint256 expiry,bool isActive,bool erased)[])"
];

const registryABI = [
  "function registerFiduciary(string,string)",
  "function approveFiduciary(address)",
  "function addAdmin(address)"
];

const accessABI = [
  "function accessData(address,uint256,string)"
];

function App() {

  const [account,setAccount] = useState("");

  const [consentContract,setConsent] = useState(null);
  const [registryContract,setRegistry] = useState(null);
  const [accessContract,setAccess] = useState(null);
  const [volunteerContract,setVolunteer] = useState(null);

  const [purpose,setPurpose] = useState("");
  const [fiduciary,setFiduciary] = useState("");

  const [hospitalName,setHospitalName] = useState("");
  const [license,setLicense] = useState("");

  const [adminAddress,setAdminAddress] = useState("");

  const [consents,setConsents] = useState([]);
  const [verificationMessage,setVerificationMessage] = useState("");

  /* CONNECT WALLET */

  const connectWallet = async () => {

    if(!window.ethereum){
      alert("Install MetaMask or HashPack");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts",[]);
    const signer = await provider.getSigner();

    setAccount(accounts[0]);

    setConsent(new ethers.Contract(CONSENT_MANAGER,consentABI,signer));
    setRegistry(new ethers.Contract(REGISTRY,registryABI,signer));
    setAccess(new ethers.Contract(ACCESS_MANAGER,accessABI,signer));

    /* Volunteer contract is read-only */
    setVolunteer(new ethers.Contract(VOLUNTEER_REGISTRY,volunteerABI,provider));
  };

  /* ========================
     VOLUNTEER QR VERIFICATION
     ======================== */

  const verifyVolunteer = async(hashId)=>{

    if(!volunteerContract){
      alert("Connect wallet first");
      return;
    }

    try{

      const result = await volunteerContract.getVolunteer(hashId);

      const cid = result[0];
      const active = result[1];

      if(!active){
        setVerificationMessage("❌ Invalid Volunteer");
        return;
      }

      const ipfsURL = `https://ipfs.io/ipfs/${cid}`;

      const response = await axios.get(ipfsURL);

      const encrypted = response.data.data;

      const decrypted = CryptoJS.AES.decrypt(
        encrypted,
        "event-secret-key"
      ).toString(CryptoJS.enc.Utf8);

      const data = JSON.parse(decrypted);

      setVerificationMessage(
        `✅ The volunteer is verified at ${data.hospital} by the incharge doctor ${data.doctor}`
      );

    }catch(err){

      console.error(err);
      setVerificationMessage("❌ Verification Failed");

    }

  };

  /* ========================
     CONSENT FUNCTIONS
     ======================== */

  const grantConsent = async () => {

    if(!consentContract) return;

    const duration = 86400;
    const fakeHash = "QmMedicalHash123";

    const tx = await consentContract.grantConsent(
      fiduciary,
      purpose,
      fakeHash,
      duration
    );

    await tx.wait();

    loadConsents();
  };

  const revokeConsent = async (index) => {

    const tx = await consentContract.revokeConsent(index);
    await tx.wait();

    loadConsents();
  };

  const eraseConsent = async (index) => {

    const tx = await consentContract.requestErasure(index);
    await tx.wait();

    loadConsents();
  };

  const loadConsents = async () => {

    const result = await consentContract.getMyConsents();
    setConsents(result);

  };

  /* ========================
     HOSPITAL FUNCTIONS
     ======================== */

  const registerHospital = async () => {

    const tx = await registryContract.registerFiduciary(
      hospitalName,
      license
    );

    await tx.wait();
  };

  const accessPatientData = async () => {

    const tx = await accessContract.accessData(
      account,
      0,
      "Medical Records"
    );

    await tx.wait();
  };

  /* ========================
     ADMIN FUNCTIONS
     ======================== */

  const approveHospital = async () => {

    const tx = await registryContract.approveFiduciary(fiduciary);
    await tx.wait();
  };

  const addAdmin = async () => {

    const tx = await registryContract.addAdmin(adminAddress);
    await tx.wait();
  };

  useEffect(()=>{

    if(consentContract){
      loadConsents();
    }

  },[consentContract]);

  return (

    <div style={{padding:40,fontFamily:"Arial"}}>

      <h1>DPDP Consent Manager (Hedera)</h1>

      {!account ?
        <button onClick={connectWallet}>Connect Wallet</button>
      :
        <p>Connected: {account}</p>
      }

      <hr/>

      <h2>Volunteer Registration</h2>
      <VolunteerRegister/>

      <hr/>

      <h2>Volunteer QR Verification</h2>

      <Scanner
        constraints={{ facingMode: "environment" }}
        formats={["qr_code"]}
        onScan={(result) => {
          if (result && result.length > 0) {
            verifyVolunteer(result[0].rawValue);
          }
        }}
      />

      <h3>{verificationMessage}</h3>

      <hr/>

      <h2>Patient — Grant Consent</h2>

      <input
        placeholder="Hospital Address"
        value={fiduciary}
        onChange={(e)=>setFiduciary(e.target.value)}
      />

      <input
        placeholder="Purpose"
        value={purpose}
        onChange={(e)=>setPurpose(e.target.value)}
      />

      <button onClick={grantConsent}>Grant Consent</button>

      <hr/>

      <h2>My Consents</h2>

      <button onClick={loadConsents}>Refresh</button>

      <table border="1" cellPadding="10">

        <tbody>

        {consents.map((c,index)=>(
          <tr key={index}>
            <td>{index}</td>
            <td>{c.purpose}</td>
            <td>{c.dataFiduciary}</td>
            <td>{c.isActive ? "Active":"Revoked"}</td>
            <td>{new Date(Number(c.expiry)*1000).toLocaleString()}</td>
            <td>
              <button onClick={()=>revokeConsent(index)}>Revoke</button>
              <button onClick={()=>eraseConsent(index)}>Erase</button>
            </td>
          </tr>
        ))}

        </tbody>

      </table>

      <hr/>

      <h2>Hospital — Register</h2>

      <input
        placeholder="Hospital Name"
        value={hospitalName}
        onChange={(e)=>setHospitalName(e.target.value)}
      />

      <input
        placeholder="License ID"
        value={license}
        onChange={(e)=>setLicense(e.target.value)}
      />

      <button onClick={registerHospital}>Register Hospital</button>

      <button onClick={accessPatientData}>Access Patient Data</button>

      <hr/>

      <h2>Admin Panel</h2>

      <input
        placeholder="Hospital Address"
        value={fiduciary}
        onChange={(e)=>setFiduciary(e.target.value)}
      />

      <button onClick={approveHospital}>Approve Hospital</button>

      <br/><br/>

      <input
        placeholder="Add Admin"
        value={adminAddress}
        onChange={(e)=>setAdminAddress(e.target.value)}
      />

      <button onClick={addAdmin}>Add Admin</button>

    </div>
  );
}

export default App;