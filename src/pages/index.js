import Head from "next/head";
import localFont from "next/font/local";
import styles from "@/styles/Home.module.css";
import wrapStaticPropsForTests from "../../test/helpers/wrap-static-props-for-tests";
import { useEffect, useState } from "react";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default function Home({ futuramaInfo }) {
  const [data, setData] = useState([]);
  const getData = async () => {
    try {
      const resp = await fetch('https://api.sampleapis.com/futurama/characters');
      const json = await resp.json();
      setData(json);
    } catch (err) {
      setData([]);
    }
  }
  useEffect(() => {
    getData();
  }, []);

  return (
    <>
      <Head>
        <title>Next Page Router E2E Testing Example</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div
        className={`${styles.page} ${geistSans.variable} ${geistMono.variable}`}
      >
        <main className={styles.main}>
          <h1>About Futurama</h1>
          <h2>Synopsis</h2>
          <p>{futuramaInfo.synopsis}</p>
          <h2>Characters</h2>
          <ul>
            {data.map(d => (
              <li key={d.id}>{d.name.first} {d.name.last}</li>
            ))}
          </ul>
        </main>
      </div>
    </>
  );
}

export const getStaticProps = wrapStaticPropsForTests(async function getStaticProps (context) {

  const resp = await fetch('https://api.sampleapis.com/futurama/info');
  return {
    props: {
      futuramaInfo: (await resp.json())[0]

    }
  };
})