import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Connect from '@/pages/Connect'
import Indexing from '@/pages/Indexing'
import Ready from '@/pages/Ready'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route
          path="/app"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/app/connect"
          element={
            <Layout>
              <Connect />
            </Layout>
          }
        />
        <Route
          path="/app/indexing/:repoId"
          element={
            <Layout>
              <Indexing />
            </Layout>
          }
        />
        <Route
          path="/app/ready/:repoId"
          element={
            <Layout>
              <Ready />
            </Layout>
          }
        />
        <Route
          path="/app/settings"
          element={
            <Layout>
              <Settings />
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
