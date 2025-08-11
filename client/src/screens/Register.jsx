import { useState } from "react";
import { Box, Button, Card, CardContent, TextField, Typography, Alert, CircularProgress, Stepper, Step, StepLabel } from "@mui/material";
import api from "../api/client";

const steps = ["Create account", "Verify email"];

export default function Signup() {
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submitRegister = async (e) => {
    e.preventDefault();
    setErr(""); setInfo(""); setLoading(true);
    try {
      await api.post("/register", form);
      setInfo("OTP sent to your email. Please enter it below.");
      setActiveStep(1);
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async (e) => {
    e.preventDefault();
    setErr(""); setInfo(""); setLoading(true);
    try {
      await api.post("/verify-otp", { email: form.email, otp });
      setInfo("Email verified. You can now log in.");
      // Optionally auto-login here by calling /login
      setTimeout(() => (window.location.href = "/login"), 1000);
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minHeight="100vh" display="grid" alignItems="center" justifyContent="center" sx={{ bgcolor: "background.default", p: 2 }}>
      <Card sx={{ width: 460, p: 1 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Sign up</Typography>

          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
            {steps.map((label) => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
          </Stepper>

          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          {info && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}

          {activeStep === 0 ? (
            <Box component="form" onSubmit={submitRegister} display="grid" gap={2}>
              <TextField name="name" label="Full name" value={form.name} onChange={onChange} required />
              <TextField name="email" label="Email" type="email" value={form.email} onChange={onChange} required />
              <TextField name="password" label="Password" type="password" value={form.password} onChange={onChange} required />
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? <CircularProgress size={20}/> : "Send OTP"}
              </Button>
              <Typography variant="body2">Already have an account? <a href="/login">Login</a></Typography>
            </Box>
          ) : (
            <Box component="form" onSubmit={submitVerify} display="grid" gap={2}>
              <TextField label="Email" value={form.email} disabled />
              <TextField label="Enter OTP" value={otp} onChange={(e)=>setOtp(e.target.value)} inputProps={{ maxLength: 6 }} required />
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? <CircularProgress size={20}/> : "Verify & Create Account"}
              </Button>
              <Button variant="text" onClick={submitRegister} disabled={loading}>
                Resend OTP
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
