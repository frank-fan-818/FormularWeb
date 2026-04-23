import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import type { SearchIndexEntry } from '@/types';

const TEXT = {
  searching: '\u641c\u7d22\u4e2d...',
  searchUnavailable: '\u641c\u7d22\u6570\u636e\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
  noSearchResults: '\u6ca1\u6709\u627e\u5230\u5339\u914d\u7684\u8f66\u624b\u3001\u8f66\u961f\u6216\u8d5b\u9053\u3002',
  searchPlaceholder: '\u641c\u7d22\u8f66\u624b\u3001\u8f66\u961f\u6216\u8d5b\u9053',
};

interface GlobalSearchBoxProps {
  autoFocus?: boolean;
  mobileOptimized?: boolean;
}

const SearchIcon = () => (
  <svg
    className="global-search-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="11" cy="11" r="5.2" />
    <path d="m15 15 4.2 4.2" />
  </svg>
);

const GlobalSearchBox = ({ autoFocus = false, mobileOptimized = false }: GlobalSearchBoxProps) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const autoFocusHandledRef = useRef(false);
  const [searchValue, setSearchValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const {
    groups,
    loading: searchLoading,
    error: searchError,
    ensureLoaded,
    runSearch,
    reset,
  } = useGlobalSearch();

  useEffect(() => {
    if (!autoFocus || autoFocusHandledRef.current) {
      return;
    }

    autoFocusHandledRef.current = true;

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      setDropdownOpen(true);
      void ensureLoaded();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [autoFocus, ensureLoaded]);

  useEffect(() => {
    const query = searchValue.trim();
    if (!query) {
      reset();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runSearch(query);
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [reset, runSearch, searchValue]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handleSelect = (item: SearchIndexEntry) => {
    navigate(item.route);
    setSearchValue('');
    setDropdownOpen(false);
    reset();
  };

  const showFeedback = dropdownOpen && (searchLoading || searchError || (searchValue.trim() && groups.length === 0));
  const showResults = dropdownOpen && groups.length > 0;

  return (
    <div className={`global-search ${mobileOptimized ? 'is-mobile-optimized' : ''}`}>
      <div className={`global-search-input-wrap ${searchError ? 'has-error' : ''}`}>
        <SearchIcon />
        <input
          ref={inputRef}
          className="global-search-input"
          value={searchValue}
          placeholder={TEXT.searchPlaceholder}
          onChange={(event) => {
            setSearchValue(event.target.value);
            setDropdownOpen(true);
            if (searchError) {
              reset();
            }
          }}
          onFocus={() => {
            if (blurTimeoutRef.current !== null) {
              window.clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = null;
            }
            setDropdownOpen(true);
            if (searchError) {
              reset();
            }
            void ensureLoaded();
          }}
          onBlur={() => {
            blurTimeoutRef.current = window.setTimeout(() => {
              setDropdownOpen(false);
            }, 120);
          }}
          role="combobox"
          aria-expanded={dropdownOpen}
          aria-autocomplete="list"
          aria-label={TEXT.searchPlaceholder}
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {searchValue ? (
          <button
            type="button"
            className="global-search-clear"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setSearchValue('');
              reset();
              inputRef.current?.focus();
            }}
            aria-label="\u6e05\u7a7a\u641c\u7d22"
          >
            x
          </button>
        ) : null}
      </div>

      {showResults ? (
        <div className="global-search-dropdown" role="listbox">
          {groups.map((group) => (
            <div className="global-search-group" key={group.type}>
              <div className="search-group-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  type="button"
                  key={`${item.type}:${item.id}`}
                  className="global-search-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(item)}
                  role="option"
                  aria-selected="false"
                >
                  <span className="global-search-option-title">{item.title}</span>
                  {item.subtitle ? (
                    <span className="global-search-option-subtitle">{item.subtitle}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {showFeedback ? (
        <div className={`global-search-dropdown global-search-feedback ${searchError ? 'error' : ''}`}>
          {searchLoading ? (
            <>
              <span className="global-search-spinner" />
              <span>{TEXT.searching}</span>
            </>
          ) : searchError ? (
            TEXT.searchUnavailable
          ) : (
            TEXT.noSearchResults
          )}
        </div>
      ) : null}
    </div>
  );
};

export default GlobalSearchBox;
