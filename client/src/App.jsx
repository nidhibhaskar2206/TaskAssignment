import './App.css'
import {Routes, Route} from 'react-router-dom'
import Login from './screens/Login'
import Signup from './screens/Register'


function App() {

  return (
    <div>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </div>
  )
}

export default App
