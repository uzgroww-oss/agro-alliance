import { useEffect, type ReactNode } from "react"
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "./lib/auth"
import Header from "./components/Header"
import Footer from "./components/Footer"
import Home from "./pages/Home"
import About from "./pages/About"
import Bloggers from "./pages/Bloggers"
import BloggerProfile from "./pages/BloggerProfile"
import Platform from "./pages/Platform"
import News from "./pages/News"
import NewsDetail from "./pages/NewsDetail"
import Partners from "./pages/Partners"
import Contact from "./pages/Contact"
import Login from "./pages/Login"
import Register from "./pages/Register"
import ResetPassword from "./pages/ResetPassword"
import Terms from "./pages/Terms"
import Privacy from "./pages/Privacy"
import NotFound from "./pages/NotFound"
import BloggerDashboard from "./pages/dashboard/BloggerDashboard"
import AdminDashboard from "./pages/dashboard/AdminDashboard"
import ClientDashboard from "./pages/dashboard/ClientDashboard"
import { roleHome } from "./lib/roles"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

function MainLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

function RequireRole({ role, children }: { role: "superadmin" | "blogger" | "client"; children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center text-muted">Yuklanmoqda…</div>
  if (!user) return <Navigate to="/kirish" replace />
  if (user.role !== role) return <Navigate to={roleHome(user.role)} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/blogerlar" element={<Bloggers />} />
            <Route path="/blogerlar/:slug" element={<BloggerProfile />} />
            <Route path="/platforma" element={<Platform />} />
            <Route path="/yangiliklar" element={<News />} />
          <Route path="/yangiliklar/:slug" element={<NewsDetail />} />
            <Route path="/hamkorlar" element={<Partners />} />
            <Route path="/aloqa" element={<Contact />} />
          <Route path="/shartlar" element={<Terms />} />
          <Route path="/maxfiylik" element={<Privacy />} />
          </Route>
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/kirish" element={<Login />} />
          <Route path="/dashboard" element={<RequireRole role="blogger"><BloggerDashboard /></RequireRole>} />
          <Route path="/admin" element={<RequireRole role="superadmin"><AdminDashboard /></RequireRole>} />
          <Route path="/mijoz" element={<RequireRole role="client"><ClientDashboard /></RequireRole>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
