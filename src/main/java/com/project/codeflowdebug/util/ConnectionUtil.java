package com.project.codeflowdebug.util;


import java.sql.Connection;
import java.sql.DriverManager;


/**
 * The ConnectionUtil Class has a method get connection which help to connect
 * with database
 */
public class ConnectionUtil {

	private ConnectionUtil() {
		// private constructor
	}

	static Logger logger = new Logger();

	public static Connection getConnection() {
		Connection con = null;

		String url;
		String userName;
		String passWord;
//
//		url = System.getenv("DATABASE_HOST");
//		userName = System.getenv("DATABASE_USERNAME");
//		passWord = System.getenv("DATABASE_PASSWORD");
	


		
		url = "jdbc:mysql://localhost:3306/codeflow";
		userName = "root";
		passWord = "1234567890";

		try {
			Class.forName("com.mysql.cj.jdbc.Driver");
			con = DriverManager.getConnection(url, userName, passWord);
			logger.info("connected");
		} catch (Exception e) {
			throw new RuntimeException("Unable to connect to the database");
		}

		return con;
	}

 

}
