import { useState } from "react";
import { ethers } from "ethers";
import { create } from "ipfs-http-client";
import CryptoJS from "crypto-js";
import { QRCodeCanvas } from "qrcode.react";
import { v4 as uuidv4 } from "uuid";

const VOLUNTEER_REGISTRY = "0x79a758403F92c9E5597a4484d9d9bd2055Da8c55";

const ABI = [
  "function addVolunteer(bytes32,string)"
];

const ipfs = create({
  url: "https://ipfs.infura.io:5001/api/v0"
});

export default function VolunteerRegister(){

  const [hospital,setHospital] = useState("");
  const [doctor,setDoctor] = useState("");

  const [hashId,setHashId] = useState("");
  const [qrData,setQrData] = useState("");

  const registerVolunteer = async () => {

    try{

      /* Step 1: create volunteer record */

      const volunteerData = {
        hospital: hospital,
        doctor: doctor
      };

      /* Step 2: encrypt */

      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(volunteerData),
        "event-secret-key"
      ).toString();

      const payload = {
        data: encrypted
      };

      /* Step 3: upload to IPFS */

      const result = await ipfs.add(JSON.stringify(payload));

      const cid = result.path;

      /* Step 4: generate hash ID */

      const id = uuidv4();

      const hash = ethers.keccak256(
        ethers.toUtf8Bytes(id)
      );

      /* Step 5: store in blockchain */

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(
        VOLUNTEER_REGISTRY,
        ABI,
        signer
      );

      const tx = await contract.addVolunteer(hash,cid);

      await tx.wait();

      setHashId(hash);
      setQrData(hash);

      alert("Volunteer registered and QR generated");

    }catch(err){

      console.error(err);
      alert("Registration failed");

    }

  };

  return(

    <div style={{padding:40}}>

      <h2>Volunteer Registration</h2>

      <input
        placeholder="Hospital Name"
        value={hospital}
        onChange={(e)=>setHospital(e.target.value)}
      />

      <br/><br/>

      <input
        placeholder="Incharge Doctor"
        value={doctor}
        onChange={(e)=>setDoctor(e.target.value)}
      />

      <br/><br/>

      <button onClick={registerVolunteer}>
        Register Volunteer
      </button>

      <br/><br/>

      {qrData && (

        <div>

          <h3>Volunteer QR Code</h3>

          <QRCodeCanvas
  value={qrData}
  size={220}
/>

          <p>HashID:</p>
          <small>{hashId}</small>

        </div>

      )}

    </div>

  );

}