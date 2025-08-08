import React from 'react';

const sidebarLinks = [
  { name: 'Departments', info: 'Explore all academic departments.' },
  { name: 'Teachers', info: 'Meet your faculty and staff.' },
  { name: 'Buildings', info: 'Find your way around campus.' },
  { name: 'Hostels', info: 'Accommodation info for students.' },
  { name: 'Clubs & Activities', info: 'Join student clubs and events.' },
];

export default function Sidebar() {
  return (
    <div className="d-flex flex-column flex-shrink-0 p-3 text-bg-dark" style={{ width: 280, minWidth: 220, background: '#23272f' }}>
      <a href="#" className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-white text-decoration-none">
        <img src="/CentAI_icon.png" alt="CentAI Icon" width="40" height="40" className="me-2" />
        <span className="fs-4 fw-bold">CentAI</span>
      </a>
      <hr />
      <ul className="nav nav-pills flex-column mb-auto">
        {sidebarLinks.map(link => (
          <li className="nav-item mb-2" key={link.name}>
            <span className="nav-link text-white" style={{ background: 'none' }}>
              <i className="bi bi-info-circle me-2"></i>
              <span className="fw-semibold">{link.name}</span>
              <div className="small text-secondary ms-4">{link.info}</div>
            </span>
          </li>
        ))}
      </ul>
      <hr />
      <div className="text-secondary small mt-auto">
        <img src="/CentAI_logo_light.png" alt="CentAI Logo" width="100" className="mb-2" /><br />
        Powered by Centurion University
      </div>
    </div>
  );
}
