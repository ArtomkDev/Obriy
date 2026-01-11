import React from 'react'
import { motion } from 'framer-motion'
import WindowControls from './WindowControls'

const ServiceLayout = ({ children }) => {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      <div className="relative flex h-[350px] w-[300px] flex-col overflow-hidden rounded bg-[#313338] shadow-2xl ring-1 ring-[#1e1f22]">
        <div className="drag-region flex h-6 shrink-0 items-center justify-end bg-[#2b2d31] px-2">
          <div className="no-drag">
            <WindowControls />
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

export default ServiceLayout