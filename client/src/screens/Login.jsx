import { useState } from "react";
import { Box, Button, Card, CardContent, TextField, Typography, Alert, CircularProgress } from "@mui/material";
import api from "../api/client";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.post("/login", form);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // navigate or reload
      window.location.href = "/"; // or use useNavigate()
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minHeight="100vh" display="grid" alignItems="center" justifyContent="center" sx={{ bgcolor: "background.default", p: 2 }}>
      <Card sx={{ width: 400, p: 1 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Login</Typography>
          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          <Box component="form" onSubmit={onSubmit} display="grid" gap={2}>
            <TextField name="email" label="Email" type="email" value={form.email} onChange={onChange} required />
            <TextField name="password" label="Password" type="password" value={form.password} onChange={onChange} required />
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={20}/> : "Login"}
            </Button>
          </Box>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Don’t have an account? <a href="/signup">Sign up</a>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
