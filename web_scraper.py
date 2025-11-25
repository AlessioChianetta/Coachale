#!/usr/bin/env python3
# web_scraper.py - Referenced from web_scraper blueprint integration
# This script extracts text content from URLs using trafilatura

import trafilatura
import sys
import json


def get_website_text_content(url: str) -> str:
    """
    This function takes a url and returns the main text content of the website.
    The text content is extracted using trafilatura and easier to understand.
    The results is not directly readable, better to be summarized by LLM before consume
    by the user.
    
    Configured to handle very large documents (100k+ characters) without truncation.
    """
    try:
        # Send a request to the website
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return ""
        
        # Extract with settings optimized for large documents
        # - include_comments=False: exclude comment sections
        # - include_tables=True: preserve table content
        # - no_fallback=False: use fallback extraction if needed
        # - favor_precision=False: prioritize recall over precision for large docs
        text = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=True,
            no_fallback=False,
            favor_precision=False
        )
        return text if text else ""
    except Exception as e:
        # Log error for debugging but return empty string to prevent crashes
        print(f"Error extracting content from {url}: {str(e)}", file=sys.stderr)
        return ""


def main():
    """
    Command line interface for the web scraper.
    Usage: python web_scraper.py <url>
    Returns JSON with status and content
    """
    if len(sys.argv) < 2:
        print(json.dumps({"error": "URL is required"}))
        sys.exit(1)
    
    url = sys.argv[1]
    
    try:
        content = get_website_text_content(url)
        if content:
            result = {
                "success": True,
                "url": url,
                "content": content,
                "length": len(content)
            }
        else:
            result = {
                "success": False,
                "url": url,
                "error": "Failed to extract content from URL"
            }
        
        print(json.dumps(result))
    except Exception as e:
        result = {
            "success": False,
            "url": url,
            "error": str(e)
        }
        print(json.dumps(result))


if __name__ == "__main__":
    main()
