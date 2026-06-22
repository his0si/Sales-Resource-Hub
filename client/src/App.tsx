import { Navigate, Route, Routes } from 'react-router-dom'
import ChatPage from './features/chat/ChatPage'
import Home from './features/home/HomePage'
import Login from './features/auth/LoginPage'
import News from './features/news/NewsPage'
import Register from './features/auth/RegisterPage'
import SalesMemoBoard from './features/sales-memo/SalesMemoBoardPage'
import SearchPage from './features/search/SearchPage'
import PostDetail from './features/trends/PostDetailPage'
import PostList from './features/trends/PostListPage'
import ProductDetail from './features/trends/ProductDetailPage'
import ProductList from './features/trends/ProductListPage'
import TrendsMain from './features/trends/TrendsMainPage'

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
      <Route path="/search" element={<SearchPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
