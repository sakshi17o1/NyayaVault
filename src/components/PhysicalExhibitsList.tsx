"use client";

import { useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Exhibit {
  id: string;
  caseId: string;
  exhibitNumber: string;
  category: string;
  description: string;
  serialNumber?: string;
  identifyingMarks?: string;
  recoveryDate?: string;
  recoveryLocation?: string;
  sourcePerson?: string;
  witnesses?: string;
  status: string;
  currentLocation: string;
  storageRequirements?: string;
  disposalEligibilityDate?: string;
  createdAt: string;
}

const formatIndianDate = (dStr: string) => {
  const d = new Date(dStr);
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}

const formatIndianDateTime = (dStr: string) => {
  const d = new Date(dStr);
  const datePart = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  const timePart = d.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${datePart} ${timePart}`;
}

function ExhibitImages({ caseId, exhibitId }: { caseId: string, exhibitId: string }) {
  const [images, setImages] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchImages();
  }, [exhibitId]);

  const fetchImages = async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/exhibits/${exhibitId}/images`);
      if (res.ok) {
        setImages(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch exhibit images", error);
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/cases/${caseId}/exhibits/${exhibitId}/images`, {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        fetchImages();
      } else {
        alert("Failed to upload image. Ensure you have the correct permissions.");
      }
    } catch (error) {
      console.error(error);
      alert("Error uploading image.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="mt-4 p-4 border rounded bg-slate-50 w-full">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-semibold text-slate-800">Baseline Photographs</h4>
        <div>
          <input type="file" id={`upload-${exhibitId}`} className="hidden" accept="image/*" onChange={handleUpload} disabled={isUploading} />
          <label htmlFor={`upload-${exhibitId}`} className={`cursor-pointer text-xs bg-navy text-white px-3 py-1.5 rounded hover:bg-navy/90 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {isUploading ? "Uploading..." : "+ Upload Photo"}
          </label>
        </div>
      </div>
      
      {images.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No baseline photographs uploaded yet.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map(img => (
            <div key={img.id} className="min-w-[150px] w-[150px] rounded border border-slate-200 overflow-hidden bg-white shadow-sm flex-shrink-0">
              <a href={`/api/cases/${caseId}/exhibits/${exhibitId}/images/${img.id}`} target="_blank" rel="noopener noreferrer">
                <img src={`/api/cases/${caseId}/exhibits/${exhibitId}/images/${img.id}`} className="h-32 w-full object-cover hover:opacity-90 transition-opacity" alt="Exhibit baseline" />
              </a>
              <div className="p-2 text-[10px] text-slate-500 flex flex-col gap-1">
                <span className="font-medium text-slate-700 truncate">{img.uploadedBy?.name || 'Unknown User'}</span>
                <span>{formatIndianDateTime(img.uploadedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PhysicalExhibitsList({ caseId }: { caseId: string }) {
  const [exhibits, setExhibits] = useState<Exhibit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  const initialExhibitState = {
    exhibitNumber: "",
    category: "OTHER",
    description: "",
    serialNumber: "",
    identifyingMarks: "",
    recoveryDate: "",
    recoveryLocation: "",
    sourcePerson: "",
    witnesses: "",
    currentLocation: "",
    storageRequirements: "",
    disposalEligibilityDate: "",
  };

  const [newExhibit, setNewExhibit] = useState(initialExhibitState);
  const [selectedQr, setSelectedQr] = useState<Exhibit | null>(null);
  const [showImagesFor, setShowImagesFor] = useState<string | null>(null);

  useEffect(() => {
    fetchExhibits();
  }, [caseId]);

  const fetchExhibits = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/exhibits`);
      if (res.ok) {
        const data = await res.json();
        setExhibits(data);
      }
    } catch (error) {
      console.error("Failed to fetch exhibits:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExhibit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newExhibit,
        recoveryDate: newExhibit.recoveryDate || undefined,
        disposalEligibilityDate: newExhibit.disposalEligibilityDate || undefined,
      };

      const res = await fetch(`/api/cases/${caseId}/exhibits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setNewExhibit(initialExhibitState);
        setIsAdding(false);
        fetchExhibits();
      } else {
        alert("Failed to add exhibit. Ensure you have IO or SHO permissions.");
      }
    } catch (error) {
      console.error(error);
      alert("Error adding exhibit.");
    }
  };

  return (
    <Card className="mt-6 border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Physical Exhibits (Malkhana Register)</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? "Cancel" : "+ Add Exhibit"}
        </Button>
      </CardHeader>
      
      <CardContent>
        {isAdding && (
          <div className="mb-6 rounded border bg-slate-50 p-4">
            <h3 className="mb-3 font-semibold text-slate-800">Add New Physical Exhibit</h3>
            <form onSubmit={handleAddExhibit} className="space-y-4">
              
              {/* Basic Details */}
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500">Exhibit Number *</label>
                  <input 
                    required type="text" className="mt-1 w-full rounded border px-3 py-2 text-sm" 
                    placeholder="e.g. EX-2026-001" value={newExhibit.exhibitNumber}
                    onChange={e => setNewExhibit({...newExhibit, exhibitNumber: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">Category</label>
                  <select 
                    className="mt-1 w-full rounded border px-3 py-2 text-sm bg-white"
                    value={newExhibit.category}
                    onChange={e => setNewExhibit({...newExhibit, category: e.target.value})}
                  >
                    <option value="NARCOTICS">Narcotics</option>
                    <option value="FIREARM">Firearm</option>
                    <option value="CURRENCY">Currency</option>
                    <option value="BIOLOGICAL">Biological</option>
                    <option value="DOCUMENT">Document</option>
                    <option value="ELECTRONIC">Electronic</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">Current Storage Location *</label>
                  <input 
                    required type="text" className="mt-1 w-full rounded border px-3 py-2 text-sm" 
                    placeholder="e.g. Vault B, Shelf 4" value={newExhibit.currentLocation}
                    onChange={e => setNewExhibit({...newExhibit, currentLocation: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500">Description *</label>
                <textarea 
                  required className="mt-1 w-full rounded border px-3 py-2 text-sm" rows={2}
                  placeholder="Describe the physical asset (e.g. Murder weapon, seized laptop)"
                  value={newExhibit.description}
                  onChange={e => setNewExhibit({...newExhibit, description: e.target.value})}
                />
              </div>

              {/* Identification Details */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500">Serial/Unique Number</label>
                  <input 
                    type="text" className="mt-1 w-full rounded border px-3 py-2 text-sm" 
                    placeholder="e.g. SN12345678" value={newExhibit.serialNumber}
                    onChange={e => setNewExhibit({...newExhibit, serialNumber: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">Identifying Marks</label>
                  <input 
                    type="text" className="mt-1 w-full rounded border px-3 py-2 text-sm" 
                    placeholder="e.g. Scratched 'X' on back" value={newExhibit.identifyingMarks}
                    onChange={e => setNewExhibit({...newExhibit, identifyingMarks: e.target.value})}
                  />
                </div>
              </div>

              {/* Acquisition Details */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500">Date/Time of Recovery</label>
                  <DatePicker
                    selected={newExhibit.recoveryDate ? new Date(newExhibit.recoveryDate) : null}
                    onChange={(date: Date | null) => setNewExhibit({...newExhibit, recoveryDate: date ? date.toISOString() : ""})}
                    showTimeSelect
                    timeFormat="hh:mm aa"
                    timeIntervals={15}
                    timeCaption="time"
                    dateFormat="dd/MM/yyyy h:mm aa"
                    placeholderText="DD/MM/YYYY HH:MM"
                    className="mt-1 w-full rounded border px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">Recovery Location / GPS</label>
                  <input 
                    type="text" className="mt-1 w-full rounded border px-3 py-2 text-sm" 
                    placeholder="e.g. 123 Main St / Lat, Long" value={newExhibit.recoveryLocation}
                    onChange={e => setNewExhibit({...newExhibit, recoveryLocation: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">Source Person (Seized from)</label>
                  <input 
                    type="text" className="mt-1 w-full rounded border px-3 py-2 text-sm" 
                    placeholder="e.g. John Doe (Suspect)" value={newExhibit.sourcePerson}
                    onChange={e => setNewExhibit({...newExhibit, sourcePerson: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">Witnesses</label>
                  <input 
                    type="text" className="mt-1 w-full rounded border px-3 py-2 text-sm" 
                    placeholder="e.g. Jane Smith, Officer Roy" value={newExhibit.witnesses}
                    onChange={e => setNewExhibit({...newExhibit, witnesses: e.target.value})}
                  />
                </div>
              </div>

              {/* Storage & Retention */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500">Storage Requirements</label>
                  <input 
                    type="text" className="mt-1 w-full rounded border px-3 py-2 text-sm" 
                    placeholder="e.g. Refrigerate, Handle with gloves" value={newExhibit.storageRequirements}
                    onChange={e => setNewExhibit({...newExhibit, storageRequirements: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">Disposal Eligibility Date</label>
                  <DatePicker
                    selected={newExhibit.disposalEligibilityDate ? new Date(newExhibit.disposalEligibilityDate) : null}
                    onChange={(date: Date | null) => setNewExhibit({...newExhibit, disposalEligibilityDate: date ? date.toISOString() : ""})}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="DD/MM/YYYY"
                    className="mt-1 w-full rounded border px-3 py-2 text-sm bg-white"
                  />
                </div>
              </div>

              <Button type="submit" size="sm" className="bg-navy hover:bg-navy/90 text-white w-full sm:w-auto">Save to Registry</Button>
            </form>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading registry...</p>
        ) : exhibits.length === 0 ? (
          <p className="text-sm text-slate-600">No physical exhibits registered for this case.</p>
        ) : (
          <div className="space-y-4">
            {exhibits.map(exhibit => (
              <div key={exhibit.id} className="flex flex-col gap-4 rounded border p-4 bg-white shadow-sm">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-navy">{exhibit.exhibitNumber}</p>
                      <Badge tone="slate" className="text-xs bg-slate-50 border">{exhibit.category}</Badge>
                      <Badge tone="slate">{exhibit.status}</Badge>
                    </div>
                    
                    <p className="text-sm text-slate-700">{exhibit.description}</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 mt-2 p-2 bg-slate-50 rounded">
                      {exhibit.serialNumber && <p><span className="font-medium">S/N:</span> {exhibit.serialNumber}</p>}
                      {exhibit.identifyingMarks && <p><span className="font-medium">Marks:</span> {exhibit.identifyingMarks}</p>}
                      {exhibit.recoveryDate && <p><span className="font-medium">Recovered:</span> {formatIndianDateTime(exhibit.recoveryDate)}</p>}
                      {exhibit.recoveryLocation && <p><span className="font-medium">Location:</span> {exhibit.recoveryLocation}</p>}
                      {exhibit.sourcePerson && <p><span className="font-medium">Source:</span> {exhibit.sourcePerson}</p>}
                      <p><span className="font-medium">Storage:</span> {exhibit.currentLocation} {exhibit.storageRequirements ? `(${exhibit.storageRequirements})` : ""}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-row md:flex-col justify-start md:items-end gap-2 min-w-[120px]">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full md:w-auto"
                      onClick={() => setShowImagesFor(showImagesFor === exhibit.id ? null : exhibit.id)}
                    >
                      {showImagesFor === exhibit.id ? "Hide Photos" : "View Photos"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full md:w-auto"
                      onClick={() => setSelectedQr(selectedQr?.id === exhibit.id ? null : exhibit)}
                    >
                      {selectedQr?.id === exhibit.id ? "Hide Label" : "Show Label"}
                    </Button>
                  </div>
                </div>

                {/* Optional Expandable Sections */}
                {showImagesFor === exhibit.id && (
                  <ExhibitImages caseId={caseId} exhibitId={exhibit.id} />
                )}
                
                {selectedQr?.id === exhibit.id && (
                  <div className="w-full rounded bg-slate-50 p-4 border flex flex-col items-center justify-center mt-2">
                    <p className="text-sm font-bold mb-2 uppercase tracking-wide">Malkhana Asset Label</p>
                    <div className="p-2 border-2 border-dashed border-slate-300 inline-block bg-white">
                      <QRCodeCanvas 
                        id={`qr-canvas-${exhibit.id}`}
                        value={`Exhibit: ${exhibit.exhibitNumber}\n\nID: ${exhibit.id}`} 
                        size={150} 
                        level={"L"}
                        includeMargin={true}
                      />
                    </div>
                    <p className="text-xs font-mono mt-2">{exhibit.exhibitNumber}</p>
                    <Button variant="ghost" size="sm" className="mt-2 text-xs border" onClick={() => {
                      const canvas = document.querySelector(`#qr-canvas-${exhibit.id}`) as HTMLCanvasElement;
                      if (canvas) {
                        const dataUrl = canvas.toDataURL("image/png");
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Print Label</title>
                                <style>
                                  body { display: flex; flex-direction: column; align-items: center; margin-top: 50px; font-family: sans-serif; }
                                  .label { border: 2px dashed #94a3b8; padding: 20px; text-align: center; max-width: 300px; }
                                  img { margin-bottom: 10px; width: 150px; height: 150px; }
                                  h2 { margin: 0 0 15px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
                                  .asset-no { margin: 0; font-family: monospace; font-size: 16px; font-weight: bold; }
                                  .details { margin-top: 15px; text-align: left; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
                                  .details p { margin: 4px 0; font-family: sans-serif; font-size: 12px; font-weight: normal; line-height: 1.4; }
                                  .details strong { color: #334155; }
                                </style>
                              </head>
                              <body>
                                <div class="label">
                                  <h2>Malkhana Asset Label</h2>
                                  <img src="${dataUrl}" alt="QR Code" />
                                  <p class="asset-no">${exhibit.exhibitNumber}</p>
                                  <div class="details">
                                    <p><strong>Item:</strong> ${exhibit.description}</p>
                                    <p><strong>Category:</strong> ${exhibit.category}</p>
                                    <p><strong>Location:</strong> ${exhibit.currentLocation}</p>
                                    <p><strong>Logged:</strong> ${formatIndianDate(exhibit.createdAt)}</p>
                                  </div>
                                </div>
                                <script>
                                  window.onload = () => { window.print(); window.close(); }
                                </script>
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                        }
                      }
                    }}>
                      Print Label
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
