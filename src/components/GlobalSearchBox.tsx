import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AutoComplete, Input, Spin } from 'antd';
import type { InputRef } from 'antd';
import type { DefaultOptionType } from 'antd/es/select';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '@/hooks';

const TEXT = {
  searching: '\u641c\u7d22\u4e2d...',
  searchUnavailable: '\u641c\u7d22\u6570\u636e\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
  noSearchResults: '\u6ca1\u6709\u627e\u5230\u5339\u914d\u7684\u8f66\u624b\u3001\u8f66\u961f\u6216\u8d5b\u9053\u3002',
  searchPlaceholder: '\u641c\u7d22\u8f66\u624b\u3001\u8f66\u961f\u6216\u8d5b\u9053',
};

interface SearchOption extends DefaultOptionType {
  route?: string;
}

interface GlobalSearchBoxProps {
  autoFocus?: boolean;
}

const GlobalSearchBox = ({ autoFocus = false }: GlobalSearchBoxProps) => {
  const navigate = useNavigate();
  const inputRef = useRef<InputRef>(null);
  const autoFocusHandledRef = useRef(false);
  const [searchValue, setSearchValue] = useState('');
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
      void ensureLoaded();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [autoFocus, ensureLoaded]);

  const searchOptions: SearchOption[] = groups.map((group) => ({
    label: <span className="search-group-label">{group.label}</span>,
    options: group.items.map((item) => ({
      value: `${item.type}:${item.id}`,
      route: item.route,
      label: (
        <div className="global-search-option">
          <div className="global-search-option-title">{item.title}</div>
          {item.subtitle ? (
            <div className="global-search-option-subtitle">{item.subtitle}</div>
          ) : null}
        </div>
      ),
    })),
  }));

  const notFoundContent: ReactNode = searchLoading ? (
    <div className="global-search-feedback">
      <Spin size="small" />
      <span>{TEXT.searching}</span>
    </div>
  ) : searchError ? (
    <div className="global-search-feedback error">{TEXT.searchUnavailable}</div>
  ) : searchValue.trim() ? (
    <div className="global-search-feedback">{TEXT.noSearchResults}</div>
  ) : null;

  return (
    <AutoComplete
      className="global-search"
      value={searchValue}
      options={searchOptions}
      onSearch={(value) => {
        setSearchValue(value);
        void runSearch(value);
      }}
      onChange={(value) => {
        setSearchValue(value);
        if (!value) {
          reset();
        }
      }}
      onSelect={(_value, option: SearchOption) => {
        if (option.route) {
          navigate(option.route);
        }
        setSearchValue('');
        reset();
      }}
      onFocus={() => {
        void ensureLoaded();
      }}
      notFoundContent={notFoundContent}
      popupClassName="global-search-dropdown"
    >
      <Input
        ref={inputRef}
        allowClear
        size="large"
        prefix={<SearchOutlined />}
        placeholder={TEXT.searchPlaceholder}
        status={searchError ? 'error' : undefined}
      />
    </AutoComplete>
  );
};

export default GlobalSearchBox;
