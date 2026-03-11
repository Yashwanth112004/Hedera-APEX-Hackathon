import { useState } from "react";
import { ethers } from "ethers";
import { create } from "ipfs-http-client";
import CryptoJS from "crypto-js";
import { QRCodeCanvas } from "qrcode.react";
import { v4 as uuidv4 } from "uuid";
import { toast } from 'react-toastify';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [hashId,setHashId] = useState("");
  const [qrData,setQrData] = useState("");

  const registerVolunteer = async () => {
    if (!hospital || !doctor) {
      toast.error('Please fill all fields');
      return;
    }

    setIsSubmitting(true);
    
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

      toast.success("Volunteer registered and QR generated successfully");
      
      // Reset form
      setHospital("");
      setDoctor("");

    }catch(error){
      console.error("Registration error:", error);
      toast.error("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return(
    <div className="volunteer-register">
      <div className="register-card">
        <div className="card-header">
          <h3>Volunteer Registration</h3>
          <p>Register healthcare volunteers for blockchain verification</p>
        </div>
        
        <div className="card-body">
          <div className="form-group">
            <label htmlFor="hospital">Hospital Name *</label>
            <input
              id="hospital"
              type="text"
              value={hospital}
              onChange={(e)=>setHospital(e.target.value)}
              placeholder="Enter hospital name"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="doctor">Incharge Doctor *</label>
            <input
              id="doctor"
              type="text"
              value={doctor}
              onChange={(e)=>setDoctor(e.target.value)}
              placeholder="Enter doctor name"
              disabled={isSubmitting}
            />
          </div>

          <button 
            className="register-btn primary-btn"
            onClick={registerVolunteer}
            disabled={isSubmitting || !hospital || !doctor}
          >
            {isSubmitting ? 'Registering...' : 'Register Volunteer'}
          </button>
        </div>
      </div>

      {qrData && (
        <div className="qr-result">
          <div className="qr-card">
            <div className="card-header">
              <h3>Volunteer QR Code</h3>
              <p>Share this QR code for verification</p>
            </div>
            
            <div className="card-body">
              <div className="qr-container">
                <QRCodeCanvas
                  value={qrData}
                  size={220}
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              <div className="hash-info">
                <label>Verification Hash:</label>
                <div className="hash-display">
                  <code>{hashId}</code>
                  <button 
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(hashId);
                      toast.success('Hash copied to clipboard');
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}