import { BrowserRouter, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { About } from './pages/About'
import { Home } from './pages/Home'
import { ListDetails } from './pages/ListDetails'
import { ListPhotos } from './pages/ListPhotos'
import { MyListings } from './pages/MyListings'
import { Result } from './pages/Result'
import { Sent } from './pages/Sent'
import { DraftProvider } from './state/draft'

export default function App() {
  return (
    <BrowserRouter>
      <DraftProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="list" element={<ListDetails />} />
            <Route path="list/photos" element={<ListPhotos />} />
            <Route path="listing/:id" element={<Result />} />
            <Route path="listing/:id/sent" element={<Sent />} />
            <Route path="listings" element={<MyListings />} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </DraftProvider>
    </BrowserRouter>
  )
}
