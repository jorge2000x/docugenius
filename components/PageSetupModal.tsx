
import React from 'react';
import { X } from 'lucide-react';
import { PageSettings } from '../types';

interface PageSetupModalProps {
  settings: PageSettings;
  onUpdate: (newSettings: PageSettings) => void;
  onClose: () => void;
}

const PageSetupModal: React.FC<PageSetupModalProps> = ({ settings, onUpdate, onClose }) => {
  
  const hasPageNumInHeader = settings.headerText?.includes('page-number');
  const hasPageNumInFooter = settings.footerText?.includes('page-number');

  const updateSetting = (key: keyof PageSettings, value: any) => {
    onUpdate({ ...settings, [key]: value });
  };

  const handlePageNumChange = (location: 'none' | 'header' | 'footer') => {
    let newHeader = settings.headerText || '';
    let newFooter = settings.footerText || '';

    // Remove existing
    newHeader = newHeader.replace(/<div[^>]*><span class="page-number">.*?<\/span><\/div>/g, '').replace(/<span class="page-number">.*?<\/span>/g, '');
    newFooter = newFooter.replace(/<div[^>]*><span class="page-number">.*?<\/span><\/div>/g, '').replace(/<span class="page-number">.*?<\/span>/g, '');

    if (location === 'header') {
        newHeader = `<div style="text-align: right;"><span class="page-number"><span>#</span></span></div>` + newHeader;
        updateSetting('hasHeader', true);
    } else if (location === 'footer') {
        newFooter = `<div style="text-align: center;"><span class="page-number"><span>#</span></span></div>` + newFooter;
        updateSetting('hasFooter', true);
    }

    onUpdate({
        ...settings,
        headerText: newHeader,
        footerText: newFooter,
        hasHeader: location === 'header' ? true : settings.hasHeader,
        hasFooter: location === 'footer' ? true : settings.hasFooter
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-96 p-6 relative animate-fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X size={20} />
        </button>
        <h2 className="text-xl font-bold mb-4">Page Setup</h2>
        
        <div className="space-y-4">
          {/* Margins */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2 border-b pb-1">Margins (mm)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Top</label>
                <input type="number" value={settings.marginTop} onChange={(e) => updateSetting('marginTop', parseFloat(e.target.value))} className="w-full border rounded px-2 py-1"/>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Bottom</label>
                <input type="number" value={settings.marginBottom} onChange={(e) => updateSetting('marginBottom', parseFloat(e.target.value))} className="w-full border rounded px-2 py-1"/>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Left</label>
                <input type="number" value={settings.marginLeft} onChange={(e) => updateSetting('marginLeft', parseFloat(e.target.value))} className="w-full border rounded px-2 py-1"/>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Right</label>
                <input type="number" value={settings.marginRight} onChange={(e) => updateSetting('marginRight', parseFloat(e.target.value))} className="w-full border rounded px-2 py-1"/>
              </div>
            </div>
          </div>

          {/* Layout Toggles */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2 border-b pb-1">Layout</h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={settings.hasHeader} onChange={(e) => updateSetting('hasHeader', e.target.checked)} />
                Enable Header
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={settings.hasFooter} onChange={(e) => updateSetting('hasFooter', e.target.checked)} />
                Enable Footer
              </label>
            </div>
          </div>

          {/* Page Numbering */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2 border-b pb-1">Automatic Page Numbering</h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name="pageNumPos" checked={!hasPageNumInHeader && !hasPageNumInFooter} onChange={() => handlePageNumChange('none')} />
                None
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name="pageNumPos" checked={!!hasPageNumInHeader} onChange={() => handlePageNumChange('header')} />
                Header
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name="pageNumPos" checked={!!hasPageNumInFooter} onChange={() => handlePageNumChange('footer')} />
                Footer
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow">Done</button>
        </div>
      </div>
    </div>
  );
};

export default PageSetupModal;
