import { useRef } from 'react';

export default function Modal({ open, title, onClose, children, wide }) {
  const isMouseDownInside = useRef(false);

  if (!open) return null;

  const handleMouseDown = (e) => {
    // If the click starts inside the modal card, remember it
    const cardElement = e.currentTarget.querySelector('.card');
    if (cardElement && cardElement.contains(e.target)) {
      isMouseDownInside.current = true;
    } else {
      isMouseDownInside.current = false;
    }
  };

  const handleMouseUp = (e) => {
    // Only close if click started outside AND ended outside the card
    if (e.target === e.currentTarget && !isMouseDownInside.current) {
      onClose();
    }
    isMouseDownInside.current = false;
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" 
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
