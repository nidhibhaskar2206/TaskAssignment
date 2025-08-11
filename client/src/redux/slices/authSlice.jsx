import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client';

// thunks
export const register = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try { const { data } = await api.post('/register', payload); return data; }
  catch (e) { return rejectWithValue(e?.message || 'Register failed'); }
});

export const verifyOtp = createAsyncThunk('auth/verifyOtp', async (payload, { rejectWithValue }) => {
  try { const { data } = await api.post('/verify-otp', payload); return data; }
  catch (e) { return rejectWithValue(e?.message || 'Verification failed'); }
});

export const login = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
  try { const { data } = await api.post('/login', payload); return data; }
  catch (e) { return rejectWithValue(e?.message || 'Login failed'); }
});

// simple localStorage helpers
const load = (k) => {
  try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
};
const save = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
};
const drop = (k) => { try { localStorage.removeItem(k); } catch {} };

const initialState = {
  user: load('user') || null,
  token: load('token') || null,
  loading: false,
  error: null,
  lastInfo: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (s) => { s.error = null; },
    logout: (s) => {
      s.user = null; s.token = null; s.error = null; s.lastInfo = null;
      drop('user'); drop('token');
    },
  },
  extraReducers: (b) => {
    // register
    b.addCase(register.pending, (s)=>{ s.loading=true; s.error=null; s.lastInfo=null; });
    b.addCase(register.fulfilled, (s,a)=>{ s.loading=false; s.lastInfo=a.payload.message || 'OTP sent'; });
    b.addCase(register.rejected, (s,a)=>{ s.loading=false; s.error=a.payload; });

    // verify
    b.addCase(verifyOtp.pending, (s)=>{ s.loading=true; s.error=null; });
    b.addCase(verifyOtp.fulfilled, (s,a)=>{ s.loading=false; s.lastInfo=a.payload.message || 'Verified'; });
    b.addCase(verifyOtp.rejected, (s,a)=>{ s.loading=false; s.error=a.payload; });

    // login
    b.addCase(login.pending, (s)=>{ s.loading=true; s.error=null; });
    b.addCase(login.fulfilled, (s,a)=>{
      s.loading=false;
      s.user = a.payload.user;
      s.token = a.payload.token;
      save('user', a.payload.user);
      save('token', a.payload.token);
      s.lastInfo = 'Login successful';
    });
    b.addCase(login.rejected, (s,a)=>{ s.loading=false; s.error=a.payload; });
  }
});

export const { clearError, logout } = authSlice.actions;
export default authSlice.reducer;
