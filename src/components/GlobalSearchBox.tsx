import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import type { SearchEntityType, SearchIndexEntry } from '@/types';
import { isSafeInternalRoute } from '@/utils/safeNavigation';

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
  const { t } = useTranslation();
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
      void ensureLoaded().catch(() => undefined);
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
    navigate(isSafeInternalRoute(item.route) ? item.route : '/');
    setSearchValue('');
    setDropdownOpen(false);
    reset();
  };

  const showFeedback = dropdownOpen && (searchLoading || searchError || (searchValue.trim() && groups.length === 0));
  const showResults = dropdownOpen && groups.length > 0;
  const groupLabels: Record<SearchEntityType, string> = {
    driver: t('searchGroupDrivers'),
    constructor: t('searchGroupConstructors'),
    circuit: t('searchGroupCircuits'),
    race: t('searchGroupRaces'),
  };

  return (
    <div className={`global-search ${mobileOptimized ? 'is-mobile-optimized' : ''}`}>
      <div className={`global-search-input-wrap ${searchError ? 'has-error' : ''}`}>
        <SearchIcon />
        <input
          ref={inputRef}
          className="global-search-input"
          value={searchValue}
          placeholder={t('searchPlaceholder')}
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
            void ensureLoaded().catch(() => undefined);
          }}
          onBlur={() => {
            blurTimeoutRef.current = window.setTimeout(() => {
              setDropdownOpen(false);
            }, 120);
          }}
          role="combobox"
          aria-expanded={dropdownOpen}
          aria-autocomplete="list"
          aria-label={t('searchPlaceholder')}
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
            aria-label={t('clearSearch')}
          >
            x
          </button>
        ) : null}
      </div>

      {showResults ? (
        <div className="global-search-dropdown" role="listbox">
          {groups.map((group) => (
            <div className="global-search-group" key={group.type}>
              <div className="search-group-label">{groupLabels[group.type]}</div>
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
              <span>{t('searching')}</span>
            </>
          ) : searchError ? (
            t('searchUnavailable')
          ) : (
            t('noSearchResults')
          )}
        </div>
      ) : null}
    </div>
  );
};

export default GlobalSearchBox;
