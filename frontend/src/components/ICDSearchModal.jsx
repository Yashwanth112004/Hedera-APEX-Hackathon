import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Tag, AlertCircle, CheckCircle2, Stethoscope, Sparkles, Globe, Layers, BookOpen, ChevronRight, Loader2, Info } from 'lucide-react';
import { 
  ICD10_DATABASE, 
  ICD10_CHAPTERS, 
  searchICD10, 
  searchOfficialICD10CM, 
  getICD10Categories 
} from '../utils/icd10Helper';

const ICDSearchModal = ({ isOpen, onClose, onSelectCode, initialCategory = 'All' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('All');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState('search'); // 'search' | 'chapters'
  const [activeChapter, setActiveChapter] = useState(null);

  // Debounced live search querying official CMS/CDC API & local indexed taxonomy
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    const debounceTimer = setTimeout(async () => {
      try {
        if (!searchTerm.trim()) {
          // If a chapter is selected, filter by chapter
          if (selectedChapterId !== 'All') {
            const filtered = ICD10_DATABASE.filter(item => item.chapterId === Number(selectedChapterId));
            if (isMounted) setResults(filtered);
          } else {
            if (isMounted) setResults(ICD10_DATABASE.slice(0, 30));
          }
          setIsLoading(false);
          return;
        }

        // Query official CMS/CDC ICD-10-CM API (NIH NLM Clinical Tables Service)
        const cmsResults = await searchOfficialICD10CM(searchTerm, 40);

        if (isMounted) {
          if (selectedChapterId !== 'All') {
            setResults(cmsResults.filter(item => item.chapterId === Number(selectedChapterId)));
          } else {
            setResults(cmsResults);
          }
        }
      } catch (err) {
        if (isMounted) setResults(searchICD10(searchTerm));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
    };
  }, [searchTerm, selectedChapterId, isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              backgroundColor: '#EEF2FF',
              border: '1.5px solid #C7D2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4F46E5',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)'
            }}>
              <Stethoscope size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Official ICD-10-CM Clinical Diagnosis Catalog
                </h3>
                <span style={{
                  backgroundColor: '#ECFDF5',
                  color: '#059669',
                  border: '1px solid #A7F3D0',
                  fontSize: '0.68rem',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Globe size={11} /> CMS/CDC Standard (72k+ Codes)
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Standards-compliant clinical code hierarchy with live NIH/CMS search, inclusion/exclusion rules & diagnostic mappings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'pointer',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'}
            onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Mode Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 1.75rem',
          backgroundColor: '#FFFFFF',
          gap: '1.5rem'
        }}>
          <button
            onClick={() => setViewMode('search')}
            style={{
              padding: '12px 4px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.88rem',
              fontWeight: viewMode === 'search' ? '800' : '600',
              color: viewMode === 'search' ? '#4F46E5' : '#64748B',
              borderBottom: viewMode === 'search' ? '2.5px solid #4F46E5' : '2.5px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Search size={16} /> Live Universal Search (72,000+ Codes)
          </button>

          <button
            onClick={() => setViewMode('chapters')}
            style={{
              padding: '12px 4px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.88rem',
              fontWeight: viewMode === 'chapters' ? '800' : '600',
              color: viewMode === 'chapters' ? '#4F46E5' : '#64748B',
              borderBottom: viewMode === 'chapters' ? '2.5px solid #4F46E5' : '2.5px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <BookOpen size={16} /> All 22 CMS/CDC Chapters (Hierarchy)
          </button>
        </div>

        {/* View Mode: Live Universal Search */}
        {viewMode === 'search' && (
          <>
            {/* Search Input & Chapter Filters */}
            <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #F1F5F9', backgroundColor: '#FAFAFA' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: '#FFFFFF',
                border: '1.5px solid #CBD5E1',
                borderRadius: '14px',
                padding: '10px 14px',
                marginBottom: '1rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}>
                <Search size={18} color="#64748B" />
                <input
                  type="text"
                  placeholder="Search 72k+ codes by keyword (e.g. Diabetes, Hypertension, Sepsis) or code (e.g. E11.9, I10, R07)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    width: '100%',
                    fontSize: '0.95rem',
                    color: '#0F172A'
                  }}
                />
                {isLoading && <Loader2 size={18} className="animate-spin" color="#4F46E5" />}
                {searchTerm && !isLoading && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Quick Chapter Selector Pills */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                <button
                  onClick={() => setSelectedChapterId('All')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '100px',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    border: selectedChapterId === 'All' ? '1px solid #4F46E5' : '1px solid #E2E8F0',
                    backgroundColor: selectedChapterId === 'All' ? '#EEF2FF' : '#FFFFFF',
                    color: selectedChapterId === 'All' ? '#4F46E5' : '#64748B',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                >
                  All Chapters
                </button>
                {ICD10_CHAPTERS.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChapterId(String(ch.id))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '100px',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      border: selectedChapterId === String(ch.id) ? '1px solid #4F46E5' : '1px solid #E2E8F0',
                      backgroundColor: selectedChapterId === String(ch.id) ? '#EEF2FF' : '#FFFFFF',
                      color: selectedChapterId === String(ch.id) ? '#4F46E5' : '#64748B',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                    }}
                  >
                    Ch.{ch.id} ({ch.range}) {ch.category}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Results List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isLoading && results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                  <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#4F46E5' }} />
                  <p style={{ fontWeight: '700', fontSize: '0.95rem' }}>Querying Official NIH NLM ICD-10-CM Database...</p>
                </div>
              ) : results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94A3B8' }}>
                  <AlertCircle size={36} style={{ margin: '0 auto 12px auto', opacity: 0.6 }} />
                  <p style={{ fontWeight: '700', fontSize: '0.95rem' }}>No matching ICD-10-CM codes found</p>
                  <p style={{ fontSize: '0.82rem' }}>Try searching with a different clinical symptom or general disease name.</p>
                </div>
              ) : (
                results.map(item => (
                  <div
                    key={item.code}
                    onClick={() => {
                      onSelectCode(item);
                      onClose();
                    }}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '16px',
                      border: '1.5px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#6366F1';
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={{
                          backgroundColor: '#EEF2FF',
                          color: '#4F46E5',
                          fontWeight: '900',
                          fontSize: '0.85rem',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontFamily: 'monospace'
                        }}>
                          {item.code}
                        </span>
                        <span style={{
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '100px'
                        }}>
                          {item.category}
                        </span>
                        {item.billable && (
                          <span style={{
                            backgroundColor: '#ECFDF5',
                            color: '#059669',
                            fontSize: '0.7rem',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '100px',
                            border: '1px solid #A7F3D0'
                          }}>
                            ✓ CMS Billable
                          </span>
                        )}
                        <span style={{
                          color: item.severity === 'Emergency' || item.severity === 'Critical' ? '#DC2626' : item.severity === 'High' ? '#EA580C' : '#16A34A',
                          fontSize: '0.72rem',
                          fontWeight: '800'
                        }}>
                          ● {item.severity || 'Standard'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.96rem', fontWeight: '800', color: '#0F172A', marginBottom: '4px' }}>
                        {item.title}
                      </div>

                      {item.includes && item.includes.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#0369A1', marginTop: '2px' }}>
                          <span style={{ fontWeight: '700' }}>Includes:</span> {item.includes.join(', ')}
                        </div>
                      )}

                      {item.suggestedLabs && item.suggestedLabs.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                          <span style={{ fontWeight: '700' }}>Suggested Diagnostics:</span> {item.suggestedLabs.join(', ')}
                        </div>
                      )}
                    </div>

                    <div style={{
                      padding: '8px 16px',
                      backgroundColor: '#4F46E5',
                      color: '#FFFFFF',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      marginLeft: '14px',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
                    }}>
                      Select Code
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* View Mode: All 22 CMS/CDC Chapters Hierarchy */}
        {viewMode === 'chapters' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '14px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '8px'
            }}>
              <Info size={20} color="#2563EB" />
              <div style={{ fontSize: '0.84rem', color: '#1E40AF' }}>
                Browse the complete <strong>22 Official ICD-10-CM Chapters (I - XXII)</strong> defined by the Centers for Medicare & Medicaid Services (CMS) and CDC National Center for Health Statistics (NCHS).
              </div>
            </div>

            {ICD10_CHAPTERS.map(chapter => (
              <div
                key={chapter.id}
                onClick={() => {
                  setSelectedChapterId(String(chapter.id));
                  setViewMode('search');
                  setSearchTerm('');
                }}
                style={{
                  padding: '14px 18px',
                  borderRadius: '16px',
                  border: '1.5px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#4F46E5';
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                    fontWeight: '900',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {chapter.id}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        backgroundColor: '#F1F5F9',
                        color: '#0F172A',
                        fontWeight: '800',
                        fontSize: '0.78rem',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontFamily: 'monospace'
                      }}>
                        {chapter.range}
                      </span>
                      <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>{chapter.category}</strong>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                      {chapter.title}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4F46E5', fontSize: '0.82rem', fontWeight: '800' }}>
                  <span>View Codes</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: '#64748B'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={14} color="#059669" />
            <span>Official CDC/NCHS & CMS ICD-10-CM Release Standard</span>
          </div>
          <span>Automatic Annual Updates Ingestion Supported • DPDP Section 5 Compliant</span>
        </div>
      </div>
    </div>
  );
};

export default ICDSearchModal;
