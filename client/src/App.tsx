import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import News from './pages/News'
import Register from './pages/Register'
import SalesMemoBoard from './pages/SalesMemoBoard'
import PostDetail from './pages/trends/PostDetail'
import PostList from './pages/trends/PostList'
import ProductDetail from './pages/trends/ProductDetail'
import ProductList from './pages/trends/ProductList'
import TrendsMain from './pages/trends/TrendsMain'

function App() {
  // 모든 화면이 라이트 고정 디자인이라 떠있는 테마 토글은 사용하지 않는다.
  // (영업일지 화면은 자체 햄버거 메뉴에서 테마를 전환)
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/trends" element={<TrendsMain />} />
      <Route path="/trends/posts" element={<PostList />} />
      <Route path="/trends/posts/:id" element={<PostDetail />} />
      <Route path="/trends/products" element={<ProductList />} />
      <Route path="/trends/products/:id" element={<ProductDetail />} />
      <Route path="/news" element={<News />} />
      <Route path="/sales-memo" element={<SalesMemoBoard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
