import { useState } from 'react'
import './App.css'
import Demo from './components/Test'

function App() {
  const [count, setCount] = useState(0)

  return (
  
      <>
      
    <div>app</div>
     <Demo/>
</>
  )
}

export default App
